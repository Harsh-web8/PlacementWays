-- Student source is queued for an isolated execution service, never run by Next.js.
alter table public.site_settings
 add column coding_enabled boolean not null default false,
 add column coding_hourly_limit integer not null default 20 check(coding_hourly_limit between 1 and 200),
 add column coding_daily_limit integer not null default 100 check(coding_daily_limit between 1 and 1000);
create table public.coding_languages (
 key text primary key check(key ~ '^[a-z][a-z0-9_]{0,29}$'),
 name text not null check(char_length(name) between 1 and 100),
 provider_id integer not null check(provider_id>0), enabled boolean not null default true
);
insert into public.coding_languages(key,name,provider_id) values
 ('python','Python',71),('javascript','JavaScript',93),('cpp','C++',54),('java','Java',91);
create table public.coding_test_cases (
 id uuid primary key default gen_random_uuid(),question_id uuid not null references public.questions(id) on delete cascade,
 input text not null default '' check(octet_length(input)<=16000),
 expected_output text not null check(octet_length(expected_output)<=16000),
 is_sample boolean not null default false,position integer not null check(position between 1 and 20),
 unique(question_id,position)
);
create table public.coding_submissions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete restrict,
 language_key text not null references public.coding_languages(key),
 source_code text not null check(octet_length(source_code) between 1 and 20000),
 kind text not null check(kind in ('run','submit')),
 status text not null default 'queued' check(status in ('queued','running','accepted','wrong_answer','compile_error','runtime_error','time_limit','error')),
 passed integer not null default 0, total integer not null check(total between 1 and 20),
 feedback jsonb not null default '[]',practice_attempt_id uuid references public.practice_attempts(id) on delete set null,
 created_at timestamptz not null default now(),finished_at timestamptz,
 check(passed between 0 and total)
);
create index coding_submissions_user on public.coding_submissions(user_id,created_at desc);
create table public.coding_jobs (
 submission_id uuid primary key references public.coding_submissions(id) on delete cascade,
 payload jsonb not null,provider_tokens jsonb,lease_id uuid,lease_until timestamptz,
 tries integer not null default 0,created_at timestamptz not null default now()
);
create index coding_jobs_queue on public.coding_jobs(lease_until,created_at);
create table public.worker_heartbeats (name text primary key,last_seen timestamptz not null);
do $$ declare tbl text; begin
 foreach tbl in array array['coding_languages','coding_test_cases','coding_submissions','coding_jobs','worker_heartbeats'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from anon,authenticated',tbl);
 end loop;
end $$;
grant select on public.coding_languages to anon,authenticated;
grant insert,update,delete on public.coding_languages,public.coding_test_cases to authenticated;
grant select on public.coding_test_cases,public.coding_submissions,public.worker_heartbeats to authenticated;
create policy languages_read on public.coding_languages for select using(enabled or public.is_admin());
create policy languages_admin on public.coding_languages for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy cases_admin on public.coding_test_cases for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy submissions_own on public.coding_submissions for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and is_active));
create policy submissions_admin on public.coding_submissions for select to authenticated using(public.is_admin());
create policy heartbeat_admin on public.worker_heartbeats for select to authenticated using(public.is_admin());
create view public.coding_examples with(security_invoker=false) as
 select c.id,c.question_id,c.input,c.expected_output,c.position from public.coding_test_cases c join public.questions q on q.id=c.question_id
 where c.is_sample and q.status='published' and q.is_practice and q.question_type in ('coding','debugging');
grant select on public.coding_examples to anon,authenticated;

create function public.start_coding_submission(p_question_id uuid,p_language text,p_source text,p_kind text) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.questions; lang public.coding_languages; cases jsonb; s public.site_settings; result uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and is_active for update;
 if not found then raise exception 'Active account required' using errcode='42501'; end if;
 select * into s from public.site_settings where id=true;
 if s.coding_enabled is not true or not exists(select 1 from public.worker_heartbeats where name='coding' and last_seen>now()-interval '2 minutes') then
  raise exception 'Code execution is temporarily unavailable' using errcode='23514'; end if;
 if p_kind is null or p_kind not in ('run','submit') or p_source is null or octet_length(p_source) not between 1 and 20000 then raise exception 'Invalid submission' using errcode='22023'; end if;
 if exists(select 1 from public.coding_submissions where user_id=auth.uid() and status in ('queued','running')) then
  raise exception 'Wait for your current execution to finish' using errcode='23514'; end if;
 if (select count(*) from public.coding_submissions where user_id=auth.uid() and created_at>now()-interval '1 hour')>=s.coding_hourly_limit
 or (select count(*) from public.coding_submissions where user_id=auth.uid() and created_at>now()-interval '24 hours')>=s.coding_daily_limit then
  raise exception 'Execution limit reached. Please try again later.' using errcode='23514'; end if;
 select * into q from public.questions where id=p_question_id and status='published' and is_practice and question_type in ('coding','debugging');
 if not found then raise exception 'Coding question unavailable' using errcode='42501'; end if;
 select * into lang from public.coding_languages where key=p_language and enabled;
 if not found then raise exception 'Language unavailable' using errcode='23514'; end if;
 select jsonb_agg(jsonb_build_object('input',input,'expected_output',expected_output,'sample',is_sample) order by position)
 into cases from public.coding_test_cases where question_id=q.id and (p_kind='submit' or is_sample);
 if cases is null or (p_kind='submit' and not exists(select 1 from public.coding_test_cases where question_id=q.id and not is_sample)) then
  raise exception 'Test cases are not ready for this question' using errcode='23514'; end if;
 insert into public.coding_submissions(user_id,question_id,language_key,source_code,kind,total)
 values(auth.uid(),q.id,lang.key,p_source,p_kind,jsonb_array_length(cases)) returning id into result;
 insert into public.coding_jobs(submission_id,payload) values(result,jsonb_build_object(
 'source',p_source,'language_id',lang.provider_id,'cases',cases,'category_id',q.category_id,'difficulty',q.difficulty,'explanation',q.explanation));
 return result;
end $$;
revoke all on function public.start_coding_submission(uuid,text,text,text) from public,anon;
grant execute on function public.start_coding_submission(uuid,text,text,text) to authenticated;

-- Workers are service-role only. Lease tokens fence stale workers after restarts.
create function public.claim_coding_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.coding_jobs; token uuid:=gen_random_uuid();
begin
 insert into public.worker_heartbeats(name,last_seen) values('coding',now()) on conflict(name) do update set last_seen=excluded.last_seen;
 update public.coding_submissions set status='error',finished_at=now() where status in ('queued','running') and created_at<now()-interval '15 minutes';
 delete from public.coding_jobs expired_job using public.coding_submissions expired_submission where expired_submission.id=expired_job.submission_id and expired_submission.status='error';
 select * into j from public.coding_jobs where lease_until is null or lease_until<now() order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 if j.tries>=3 then
  update public.coding_submissions set status='error',finished_at=now() where id=j.submission_id;
  delete from public.coding_jobs where submission_id=j.submission_id; return null;
 end if;
 update public.coding_jobs set lease_id=token,lease_until=now()+interval '90 seconds',tries=tries+1 where submission_id=j.submission_id;
 update public.coding_submissions set status='running' where id=j.submission_id;
 return jsonb_build_object('id',j.submission_id,'lease',token,'payload',j.payload,'tokens',j.provider_tokens);
end $$;
create function public.save_coding_tokens(p_id uuid,p_lease uuid,p_tokens jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(p_tokens)<>'array' or octet_length(p_tokens::text)>10000 then raise exception 'Invalid tokens'; end if;
 update public.coding_jobs set provider_tokens=p_tokens where submission_id=p_id and lease_id=p_lease and lease_until>now();
 return found;
end $$;
create function public.finish_coding_job(p_id uuid,p_lease uuid,p_status text,p_passed integer,p_feedback jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.coding_jobs; s public.coding_submissions; practice_id uuid;
begin
 select * into j from public.coding_jobs where submission_id=p_id and lease_id=p_lease and lease_until>now() for update;
 if not found then return false; end if;
 select * into s from public.coding_submissions where id=p_id for update;
 if p_status is null or p_status not in ('accepted','wrong_answer','compile_error','runtime_error','time_limit','error')
 or p_passed is null or p_passed<0 or p_passed>s.total or (p_status='accepted' and p_passed<>s.total)
 or p_feedback is null or jsonb_typeof(p_feedback)<>'array' or octet_length(p_feedback::text)>100000 then raise exception 'Invalid result' using errcode='22023'; end if;
 if s.kind='submit' and p_status<>'error' then
  insert into public.practice_attempts(user_id,question_id,category_id,difficulty,selected_answer,is_correct,explanation)
  values(s.user_id,s.question_id,(j.payload->>'category_id')::uuid,(j.payload->>'difficulty')::public.difficulty_level,s.source_code,p_status='accepted',j.payload->>'explanation') returning id into practice_id;
 end if;
 update public.coding_submissions set status=p_status,passed=p_passed,feedback=p_feedback,finished_at=now(),practice_attempt_id=practice_id where id=p_id;
 delete from public.coding_jobs where submission_id=p_id;
 return true;
end $$;
revoke all on function public.claim_coding_job(),public.save_coding_tokens(uuid,uuid,jsonb),public.finish_coding_job(uuid,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.claim_coding_job(),public.save_coding_tokens(uuid,uuid,jsonb),public.finish_coding_job(uuid,uuid,text,integer,jsonb) to service_role;
