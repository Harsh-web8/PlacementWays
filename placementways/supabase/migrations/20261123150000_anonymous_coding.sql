-- M05: no-login coding with session-bound access, IP-HMAC quotas and the existing isolated worker.
-- Apply only after 20261002090000_coding_execution.sql. Never expose these RPCs to anon/authenticated.
ALTER TABLE public.coding_submissions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.coding_submissions
  ADD COLUMN guest_token_hash text CHECK (guest_token_hash ~ '^[a-f0-9]{64}$'),
  ADD COLUMN guest_network_hash text CHECK (guest_network_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT coding_submission_owner_ck CHECK (
    (user_id IS NOT NULL AND guest_token_hash IS NULL AND guest_network_hash IS NULL)
    OR (user_id IS NULL AND guest_token_hash IS NOT NULL AND guest_network_hash IS NOT NULL)
  );
CREATE INDEX coding_submissions_guest_limits ON public.coding_submissions(guest_token_hash,created_at DESC) WHERE guest_token_hash IS NOT NULL;
CREATE INDEX coding_submissions_network_limits ON public.coding_submissions(guest_network_hash,created_at DESC) WHERE guest_network_hash IS NOT NULL;

CREATE FUNCTION public.start_guest_coding_submission(
 p_guest_hash text,p_network_hash text,p_question_id uuid,p_language text,p_source text,p_kind text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.questions; lang public.coding_languages; cases jsonb; s public.site_settings; result uuid;
BEGIN
 IF p_guest_hash IS NULL OR p_guest_hash !~ '^[a-f0-9]{64}$' OR p_network_hash IS NULL OR p_network_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid guest token' USING errcode='22023'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('run','submit') OR p_source IS NULL OR octet_length(p_source) NOT BETWEEN 1 AND 20000 THEN
  RAISE EXCEPTION 'Invalid submission' USING errcode='22023'; END IF;
 -- Serialize quotas across concurrent visitor requests. Different tokens on one IP also share the network lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('pw-guest:'||p_guest_hash,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('pw-network:'||p_network_hash,1));
 SELECT * INTO s FROM public.site_settings WHERE id=true;
 IF s.coding_enabled IS NOT TRUE OR NOT EXISTS(
  SELECT 1 FROM public.worker_heartbeats WHERE name='coding' AND last_seen > now()-interval '2 minutes'
 ) THEN RAISE EXCEPTION 'Execution temporarily unavailable' USING errcode='23514'; END IF;
 IF EXISTS (SELECT 1 FROM public.coding_submissions WHERE guest_token_hash=p_guest_hash AND status IN ('queued','running')) THEN
  RAISE EXCEPTION 'Please finish your current run' USING errcode='23514'; END IF;
 IF (SELECT count(*) FROM public.coding_submissions WHERE guest_token_hash=p_guest_hash AND created_at>now()-interval '1 hour') >= LEAST(s.coding_hourly_limit,6)
  OR (SELECT count(*) FROM public.coding_submissions WHERE guest_token_hash=p_guest_hash AND created_at>now()-interval '24 hours') >= LEAST(s.coding_daily_limit,20)
  OR (SELECT count(*) FROM public.coding_submissions WHERE guest_network_hash=p_network_hash AND created_at>now()-interval '1 hour') >= 24
  OR (SELECT count(*) FROM public.coding_submissions WHERE guest_network_hash=p_network_hash AND created_at>now()-interval '24 hours') >= 80
 THEN RAISE EXCEPTION 'Anonymous execution limit reached' USING errcode='23514'; END IF;
 SELECT * INTO q FROM public.questions WHERE id=p_question_id AND status='published' AND is_practice AND question_type IN ('coding','debugging');
 IF NOT FOUND THEN RAISE EXCEPTION 'Question unavailable' USING errcode='42501'; END IF;
 SELECT * INTO lang FROM public.coding_languages WHERE key=p_language AND enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'Language unavailable' USING errcode='23514'; END IF;
 SELECT jsonb_agg(jsonb_build_object('input',input,'expected_output',expected_output,'sample',is_sample) ORDER BY position)
 INTO cases FROM public.coding_test_cases WHERE question_id=q.id AND (p_kind='submit' OR is_sample);
 IF cases IS NULL OR (p_kind='submit' AND NOT EXISTS(
  SELECT 1 FROM public.coding_test_cases WHERE question_id=q.id AND NOT is_sample
 )) THEN RAISE EXCEPTION 'Question test cases not configured' USING errcode='23514'; END IF;
 INSERT INTO public.coding_submissions(user_id,guest_token_hash,guest_network_hash,question_id,language_key,source_code,kind,total)
 VALUES(NULL,p_guest_hash,p_network_hash,q.id,lang.key,p_source,p_kind,jsonb_array_length(cases)) RETURNING id INTO result;
 INSERT INTO public.coding_jobs(submission_id,payload) VALUES(result,jsonb_build_object(
  'source',p_source,'language_id',lang.provider_id,'cases',cases,'category_id',q.category_id,
  'difficulty',q.difficulty,'explanation',q.explanation));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.start_guest_coding_submission(text,text,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_guest_coding_submission(text,text,uuid,text,text,text) TO service_role;

CREATE FUNCTION public.get_guest_coding_submission(p_guest_hash text,p_submission_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(s) FROM (
  SELECT id,status,kind,passed,total,feedback,source_code,language_key,created_at
  FROM public.coding_submissions WHERE id=p_submission_id AND guest_token_hash=p_guest_hash
 ) s;
$$;
REVOKE ALL ON FUNCTION public.get_guest_coding_submission(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_coding_submission(text,uuid) TO service_role;

-- Retain existing worker processing and signed-in practice results; guests don't have a profile.
CREATE OR REPLACE FUNCTION public.finish_coding_job(p_id uuid,p_lease uuid,p_status text,p_passed integer,p_feedback jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.coding_jobs; s public.coding_submissions; practice_id uuid;
BEGIN
 SELECT * INTO j FROM public.coding_jobs WHERE submission_id=p_id AND lease_id=p_lease AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO s FROM public.coding_submissions WHERE id=p_id FOR UPDATE;
 IF p_status IS NULL OR p_status NOT IN ('accepted','wrong_answer','compile_error','runtime_error','time_limit','error')
  OR p_passed IS NULL OR p_passed<0 OR p_passed>s.total OR (p_status='accepted' AND p_passed<>s.total)
  OR p_feedback IS NULL OR jsonb_typeof(p_feedback)<>'array' OR octet_length(p_feedback::text)>100000
 THEN RAISE EXCEPTION 'Invalid result' USING errcode='22023'; END IF;
 IF s.user_id IS NOT NULL AND s.kind='submit' AND p_status<>'error' THEN
  INSERT INTO public.practice_attempts(user_id,question_id,category_id,difficulty,selected_answer,is_correct,explanation)
  VALUES(s.user_id,s.question_id,(j.payload->>'category_id')::uuid,(j.payload->>'difficulty')::public.difficulty_level,
   s.source_code,p_status='accepted',j.payload->>'explanation') RETURNING id INTO practice_id;
 END IF;
 UPDATE public.coding_submissions SET status=p_status,passed=p_passed,feedback=p_feedback,finished_at=now(),practice_attempt_id=practice_id WHERE id=p_id;
 DELETE FROM public.coding_jobs WHERE submission_id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.finish_coding_job(uuid,uuid,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_coding_job(uuid,uuid,text,integer,jsonb) TO service_role;

CREATE FUNCTION public.purge_guest_coding_history() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 DELETE FROM public.coding_submissions WHERE guest_token_hash IS NOT NULL
 AND status NOT IN ('queued','running') AND created_at < now()-interval '30 days';
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_guest_coding_history() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_guest_coding_history() TO service_role;
