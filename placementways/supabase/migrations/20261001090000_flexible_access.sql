-- Access policy extends the existing test engine; no second scoring system.
create type public.mock_access_type as enum ('PUBLIC','GUEST_FREE','LOGIN_REQUIRED','PREMIUM');
alter table public.mock_tests
 add column access_type public.mock_access_type not null default 'GUEST_FREE',
 add column guest_attempt_allowed boolean not null default true,
 add column guest_attempt_limit integer not null default 1 check (guest_attempt_limit between 0 and 100),
 add column authenticated_attempt_limit integer check (authenticated_attempt_limit between 0 and 10000),
 add column price_paise integer not null default 0 check (price_paise >= 0);
update public.mock_tests set access_type='PREMIUM',guest_attempt_allowed=false where not is_free;
-- is_free is retained for existing catalogs. Premium always wins, including legacy writes.
create function public.sync_mock_access() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.access_type is distinct from old.access_type then
  new.is_free := new.access_type <> 'PREMIUM';
 elsif not new.is_free then new.access_type := 'PREMIUM';
 elsif tg_op='UPDATE' and new.is_free is distinct from old.is_free then new.access_type := 'LOGIN_REQUIRED';
 end if;
 if new.access_type='PREMIUM' then new.is_free:=false; end if;
 if new.access_type in ('PREMIUM','LOGIN_REQUIRED') then new.guest_attempt_allowed:=false; end if;
 if new.is_free then new.price_paise:=0; end if;
 return new;
end $$;
create trigger sync_mock_access before insert or update on public.mock_tests for each row execute function public.sync_mock_access();
revoke all on function public.sync_mock_access() from public,anon,authenticated;

alter table public.site_settings
 add column guest_mock_enabled boolean not null default true,
 add column guest_mock_limit integer not null default 1 check(guest_mock_limit between 0 and 100),
 add column guest_network_daily_limit integer not null default 5 check(guest_network_daily_limit between 1 and 1000);

create table public.content_entitlements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 test_id uuid references public.mock_tests(id) on delete cascade,
 course_id uuid references public.courses(id) on delete cascade,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 check (num_nonnulls(test_id,course_id)=1)
);
create unique index entitlement_test on public.content_entitlements(user_id,test_id) where test_id is not null;
create unique index entitlement_course on public.content_entitlements(user_id,course_id) where course_id is not null;
alter table public.content_entitlements enable row level security;
revoke all on public.content_entitlements from anon,authenticated;
grant select,insert,update,delete on public.content_entitlements to authenticated;
create policy entitlement_admin on public.content_entitlements for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy entitlement_own on public.content_entitlements for select to authenticated using(user_id=auth.uid());
create function public.has_content_access(p_test_id uuid default null,p_course_id uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.content_entitlements e join public.profiles p on p.id=e.user_id
 where e.user_id=auth.uid() and p.is_active and (e.expires_at is null or e.expires_at>now())
 and ((p_test_id is not null and e.test_id=p_test_id) or (p_course_id is not null and e.course_id=p_course_id)))
$$;
revoke all on function public.has_content_access(uuid,uuid) from public;
grant execute on function public.has_content_access(uuid,uuid) to anon,authenticated;

-- Only hashes of random bearer tokens are stored. No guest email, IP, or fingerprint.
create table public.guest_mock_sessions (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 days'
);
create table public.guest_mock_rate_limits (
 network_hash text primary key check(network_hash ~ '^[a-f0-9]{64}$'),
 starts integer not null default 0,
 expires_at timestamptz not null default now()+interval '2 days'
);
alter table public.guest_mock_sessions enable row level security;
alter table public.guest_mock_rate_limits enable row level security;
revoke all on public.guest_mock_sessions,public.guest_mock_rate_limits from anon,authenticated;
alter table public.test_attempts alter column user_id drop not null;
alter table public.test_attempts add column guest_id uuid references public.guest_mock_sessions(id);
alter table public.test_attempts add constraint attempt_owner_required check(user_id is not null or guest_id is not null);
create index attempts_guest on public.test_attempts(guest_id);
create unique index guest_running_test on public.test_attempts(guest_id,test_id) where user_id is null and status='in_progress';

-- This context is set exclusively by the service-role gateway, never from a JWT.
create function public.owns_attempt(p_attempt public.test_attempts) returns boolean
language sql stable security definer set search_path='' as $$
 select (p_attempt.user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and is_active))
 or (p_attempt.user_id is null and exists(select 1 from public.guest_mock_sessions g where g.id=p_attempt.guest_id
 and g.token_hash=nullif(current_setting('placementways.guest_hash',true),'') and g.expires_at>now()))
$$;
revoke all on function public.owns_attempt(public.test_attempts) from public,anon,authenticated;

create or replace function public.save_attempt_answer_internal(
  p_attempt_id uuid, p_question_id uuid, p_selected text, p_marked boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.test_attempts;
begin

  select * into v_attempt
  from public.test_attempts
  where id = p_attempt_id and public.owns_attempt(test_attempts)
  for update;

  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    return 'closed';
  end if;
  if now() > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    return 'closed';
  end if;

  -- A trigger rejects questions that aren't in this test; a foreign key
  -- rejects an option key that isn't one of the question's options.
  perform public.upsert_attempt_answer(p_attempt_id, p_question_id, p_selected, p_marked);
  return 'saved';
end;
$$;

create or replace function public.submit_attempt_internal(p_attempt_id uuid, p_answers jsonb default null) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.test_attempts;
  v_now     timestamptz := now();
  v_item    jsonb;
begin

  select * into v_attempt
  from public.test_attempts
  where id = p_attempt_id and public.owns_attempt(test_attempts)
  for update;

  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  -- Submitting twice is harmless: report what already happened.
  if v_attempt.status <> 'in_progress' then
    return v_attempt.status::text;
  end if;

  if v_now > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    return 'expired';
  end if;

  if jsonb_typeof(p_answers) = 'array' then
    for v_item in select * from jsonb_array_elements(p_answers)
    loop
      begin
        perform public.upsert_attempt_answer(
          p_attempt_id,
          (v_item->>'question_id')::uuid,
          nullif(v_item->>'selected_answer', ''),
          coalesce((v_item->>'marked_for_review')::boolean, false)
        );
      exception
        when foreign_key_violation or check_violation or invalid_text_representation then
          null; -- skip a stale/invalid entry; the rest of the answers still count
      end;
    end loop;
  end if;

  perform public.finalize_attempt(p_attempt_id, 'submitted', v_now);
  return 'submitted';
end;
$$;

create or replace function public.get_attempt_state_internal(p_attempt_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.test_attempts;
  v_test    public.mock_tests;
  v_result  jsonb;
begin

  select * into v_attempt from public.test_attempts where id = p_attempt_id and public.owns_attempt(test_attempts);
  if not found then
    return null;
  end if;

  if v_attempt.status = 'in_progress' and now() > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    select * into v_attempt from public.test_attempts where id = p_attempt_id;
  end if;

  select * into v_test from public.mock_tests where id = v_attempt.test_id;

  v_result := jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'status', v_attempt.status,
      'started_at', v_attempt.started_at,
      'expires_at', v_attempt.expires_at,
      'server_now', now()
    ),
    'test', jsonb_build_object(
      'id', v_test.id,
      'title', v_test.title,
      'slug', v_test.slug,
      'instructions', v_test.instructions,
      'duration_minutes', v_test.duration_minutes
    )
  );

  if v_attempt.status = 'in_progress' then
    v_result := v_result || jsonb_build_object(
      'questions', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'order', tq.question_order,
            'type', q.question_type,
            'text', q.question_text,
            'marks', tq.marks,
            'negative_marks', tq.negative_marks,
            'options', (
              select coalesce(jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.option_text)
                                        order by o.option_key), '[]'::jsonb)
              from public.question_options o where o.question_id = q.id
            )
          ) order by tq.question_order
        ), '[]'::jsonb)
        from public.test_questions tq
        join public.questions q on q.id = tq.question_id
        where tq.test_id = v_attempt.test_id
      ),
      'answers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'question_id', aa.question_id,
          'selected_answer', aa.selected_answer,
          'marked_for_review', aa.marked_for_review
        )), '[]'::jsonb)
        from public.attempt_answers aa where aa.attempt_id = p_attempt_id
      )
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.get_attempt_result_internal(p_attempt_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.test_attempts;
  v_test    public.mock_tests;
begin

  select * into v_attempt from public.test_attempts where id = p_attempt_id and public.owns_attempt(test_attempts);
  if not found then
    return null;
  end if;

  if v_attempt.status = 'in_progress' and now() > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    select * into v_attempt from public.test_attempts where id = p_attempt_id;
  end if;

  if v_attempt.status = 'in_progress' then
    return null;
  end if;

  select * into v_test from public.mock_tests where id = v_attempt.test_id;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'status', v_attempt.status,
      'started_at', v_attempt.started_at,
      'submitted_at', v_attempt.submitted_at,
      'score', v_attempt.score,
      'total_marks', v_attempt.total_marks,
      'time_used_seconds', v_attempt.time_used_seconds
    ),
    'test', jsonb_build_object(
      'id', v_test.id, 'title', v_test.title, 'slug', v_test.slug,
      'duration_minutes', v_test.duration_minutes
    ),
    'summary', (
      select jsonb_build_object(
        'question_count', count(*),
        'correct',    count(*) filter (where aa.is_correct is true),
        'incorrect',  count(*) filter (where aa.is_correct is false),
        'unanswered', count(*) filter (where aa.selected_answer is null)
      )
      from public.attempt_answers aa where aa.attempt_id = p_attempt_id
    ),
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'order', tq.question_order,
          'type', q.question_type,
          'text', q.question_text,
          'difficulty', q.difficulty,
          'category_id', q.category_id,
          'category_name', c.name,
          'explanation', q.explanation,
          'correct_answer', q.correct_answer,
          'selected_answer', aa.selected_answer,
          'is_correct', aa.is_correct,
          'marks_awarded', aa.marks_awarded,
          'marked_for_review', aa.marked_for_review,
          'marks', tq.marks,
          'negative_marks', tq.negative_marks,
          'options', (
            select coalesce(jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.option_text)
                                      order by o.option_key), '[]'::jsonb)
            from public.question_options o where o.question_id = q.id
          )
        ) order by tq.question_order nulls last
      ), '[]'::jsonb)
      from public.attempt_answers aa
      join public.questions q on q.id = aa.question_id
      join public.categories c on c.id = q.category_id
      left join public.test_questions tq on tq.test_id = v_attempt.test_id and tq.question_id = aa.question_id
      where aa.attempt_id = p_attempt_id
    )
  );
end;
$$;

create or replace function public.guard_attempt_start() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(73501901);
 if new.user_id is not null and not exists(select 1 from public.profiles where id=new.user_id and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
 if exists(select 1 from public.mock_tests t join public.companies c on c.id=t.company_id where t.id=new.test_id and c.status<>'published') then
  raise exception 'Company preparation is unavailable' using errcode='23514';
 end if;
 if exists(select 1 from public.test_questions tq join public.questions q on q.id=tq.question_id where tq.test_id=new.test_id and (q.status<>'published' or q.question_type<>'mcq')) then
  raise exception 'Timed mocks require published multiple-choice questions' using errcode='23514';
 end if;
 if (select count(*) from public.test_attempts where user_id=new.user_id and started_at>now()-interval '1 hour')>=30 then
  raise exception 'Too many test starts. Try again later.' using errcode='23514';
 end if;
 return new;
end $$;

-- Close existing premium mock bypass before exposing premium course links.
create or replace function public.start_test_attempt(p_test_id uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_active  boolean;
  v_attempt public.test_attempts;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select is_active into v_active from public.profiles where id = v_uid;
  if v_active is not true then
    raise exception 'Account is not active' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(73501901);
  if exists(select 1 from public.mock_tests where id=p_test_id and status<>'published') then raise exception 'Test is not available' using errcode='23514'; end if;
  if exists(select 1 from public.mock_tests where id=p_test_id and not is_free) and not public.has_content_access(p_test_id,null) then
    raise exception 'Premium access required' using errcode='42501';
  end if;

  -- Serialise concurrent "start" clicks / tabs for the same student + test.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_test_id::text, 0));

  select * into v_attempt
  from public.test_attempts
  where user_id = v_uid and test_id = p_test_id and status = 'in_progress'
  for update;

  if found then
    if now() <= v_attempt.expires_at + public.attempt_grace() then
      return v_attempt.id; -- resume the running attempt
    end if;
    perform public.finalize_attempt(v_attempt.id, 'expired', v_attempt.expires_at);
  end if;

  if (select count(*) from public.test_attempts where user_id=v_uid and test_id=p_test_id) >= (select authenticated_attempt_limit from public.mock_tests where id=p_test_id) then raise exception 'You have reached the attempt limit for this mock.' using errcode='23514'; end if;

  if not exists (select 1 from public.test_questions where test_id = p_test_id) then
    raise exception 'This test has no questions yet' using errcode = '23514';
  end if;

  -- A trigger rejects unpublished tests and sets the server-side deadline.
  insert into public.test_attempts (user_id, test_id) values (v_uid, p_test_id)
  returning id into v_id;
  return v_id;
end;
$$;


create or replace function public.can_read_lesson(p_lesson_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.lessons l
  join public.course_modules m on m.id = l.module_id
  join public.courses c on c.id = m.course_id
  where l.id = p_lesson_id and l.status = 'published'
    and m.status = 'published' and c.status = 'published'
    and (c.company_id is null or exists(select 1 from public.companies co where co.id=c.company_id and co.status='published'))
    and (c.is_free or l.is_free or public.has_content_access(null,c.id))
 );
$$;

create or replace function public.start_course(p_course_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
  raise exception 'Active account required' using errcode='42501';
 end if;
 if not exists(select 1 from public.courses c where id=p_course_id and status='published' and (is_free or public.has_content_access(null,c.id))
   and (c.company_id is null or exists(select 1 from public.companies co where co.id=c.company_id and co.status='published'))) then
  raise exception 'Course unavailable or locked' using errcode='42501';
 end if;
 insert into public.course_progress(user_id,course_id) values(auth.uid(),p_course_id) on conflict do nothing;
end $$;
-- The gateway is the only anonymous attempt surface; browser API roles cannot call it.
create function public.guest_mock_gateway(
 p_operation text, p_token_hash text, p_test_id uuid default null,
 p_attempt_id uuid default null, p_network_hash text default null,
 p_question_id uuid default null, p_selected text default null,
 p_marked boolean default false, p_answers jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.guest_mock_sessions; a public.test_attempts; t public.mock_tests; s public.site_settings; v_id uuid; n integer;
begin
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid session' using errcode='22023'; end if;
 perform set_config('placementways.guest_hash',p_token_hash,true);
 if p_operation in ('start','access') then
  -- Same lock as content edits and signed-in starts; prevents concurrent quota bypass.
  perform pg_advisory_xact_lock(73501901);
  select * into t from public.mock_tests where id=p_test_id and status='published';
  if not found then return jsonb_build_object('decision','unavailable'); end if;
  if not t.is_free or t.access_type='PREMIUM' then return jsonb_build_object('decision','premium'); end if;
  select * into s from public.site_settings where id=true;
  if s.guest_mock_enabled is not true or not t.guest_attempt_allowed or t.access_type='LOGIN_REQUIRED' then
   return jsonb_build_object('decision','login'); end if;
  select * into g from public.guest_mock_sessions where token_hash=p_token_hash and expires_at>now();
  if g.id is not null then
   select * into a from public.test_attempts where guest_id=g.id and user_id is null and test_id=p_test_id and status='in_progress' for update;
   if found and now() <= a.expires_at+public.attempt_grace() then return jsonb_build_object('decision','allow','attempt_id',a.id); end if;
   if a.id is not null then perform public.finalize_attempt(a.id,'expired',a.expires_at); end if;
  end if;
  -- Starts reserve quota immediately, preventing parallel mocks or abandoned-test resets.
  if (select count(*) from public.test_attempts where guest_id=g.id)>=s.guest_mock_limit
   or (select count(*) from public.test_attempts where guest_id=g.id and test_id=p_test_id)>=t.guest_attempt_limit
   or s.guest_mock_limit=0 or t.guest_attempt_limit=0 then return jsonb_build_object('decision','login'); end if;
  if p_operation='access' then return jsonb_build_object('decision','allow'); end if;
  if p_network_hash is null or p_network_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid rate key' using errcode='22023'; end if;
  delete from public.guest_mock_rate_limits where expires_at<now();
  insert into public.guest_mock_rate_limits(network_hash) values(p_network_hash) on conflict do nothing;
  select starts into n from public.guest_mock_rate_limits where network_hash=p_network_hash for update;
  if n>=s.guest_network_daily_limit then return jsonb_build_object('decision','rate_limited'); end if;
  if not exists(select 1 from public.test_questions where test_id=p_test_id) then return jsonb_build_object('decision','unavailable'); end if;
  if g.id is null then
   -- Expired tokens cannot silently regain quota: only the server can issue another token.
   if exists(select 1 from public.guest_mock_sessions where token_hash=p_token_hash) then return jsonb_build_object('decision','login'); end if;
   insert into public.guest_mock_sessions(token_hash) values(p_token_hash) returning * into g;
  end if;
  insert into public.test_attempts(guest_id,test_id) values(g.id,p_test_id) returning id into v_id;
  update public.guest_mock_rate_limits set starts=starts+1 where network_hash=p_network_hash;
  return jsonb_build_object('decision','allow','attempt_id',v_id);
 end if;
 if not exists(select 1 from public.test_attempts where id=p_attempt_id and public.owns_attempt(test_attempts)) then return null; end if;
 case p_operation
 when 'state' then return public.get_attempt_state_internal(p_attempt_id);
 when 'result' then return public.get_attempt_result_internal(p_attempt_id);
 when 'save' then return to_jsonb(public.save_attempt_answer_internal(p_attempt_id,p_question_id,p_selected,p_marked));
 when 'submit' then
  if p_answers is not null and (jsonb_typeof(p_answers)<>'array' or octet_length(p_answers::text)>200000) then raise exception 'Invalid answers' using errcode='22023'; end if;
  return to_jsonb(public.submit_attempt_internal(p_attempt_id,p_answers));
 else raise exception 'Invalid operation' using errcode='22023';
 end case;
end $$;
revoke all on function public.guest_mock_gateway(text,text,uuid,uuid,text,uuid,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.guest_mock_gateway(text,text,uuid,uuid,text,uuid,text,boolean,jsonb) to service_role;

create function public.mock_access_decision(p_test_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare t public.mock_tests;
begin
 select * into t from public.mock_tests where id=p_test_id and status='published';
 if not found then return 'unavailable'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then return 'login'; end if;
 if not t.is_free and not public.has_content_access(p_test_id,null) then return 'premium'; end if;
 if exists(select 1 from public.test_attempts where test_id=p_test_id and user_id=auth.uid() and status='in_progress' and expires_at+public.attempt_grace()>=now()) then return 'allow'; end if;
 if (select count(*) from public.test_attempts where user_id=auth.uid() and test_id=p_test_id)>=t.authenticated_attempt_limit then return 'limit'; end if;
 return 'allow';
end $$;
revoke all on function public.mock_access_decision(uuid) from public,anon;
grant execute on function public.mock_access_decision(uuid) to authenticated;

-- Claim transfers only ownership; scores, deadlines and the original guest quota stay intact.
create or replace function public.test_attempts_before_update() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.user_id is null and new.user_id is not null and old.guest_id is not null
 and current_setting('placementways.claim_attempt',true)=old.id::text
 and (to_jsonb(new)-'user_id')=(to_jsonb(old)-'user_id') then return new; end if;
 if old.status<>'in_progress' then raise exception 'This attempt has already been finalised' using errcode='55000'; end if;
 if (new.user_id,new.guest_id,new.test_id,new.started_at,new.expires_at) is distinct from
 (old.user_id,old.guest_id,old.test_id,old.started_at,old.expires_at) then
 raise exception 'Attempt identity and deadline are immutable' using errcode='55000'; end if;
 return new;
end $$;
create function public.claim_guest_mock(p_token_hash text,p_attempt_id uuid,p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;
begin
 if not exists(select 1 from public.profiles where id=p_user_id and is_active) then return false; end if;
 select * into a from public.test_attempts where id=p_attempt_id for update;
 if not found then return false; end if;
 if a.user_id=p_user_id then return true; end if;
 if a.user_id is not null or a.status='in_progress' or not exists(select 1 from public.guest_mock_sessions where id=a.guest_id and token_hash=p_token_hash and expires_at>now()) then return false; end if;
 perform set_config('placementways.claim_attempt',a.id::text,true);
 update public.test_attempts set user_id=p_user_id where id=a.id;
 return true;
end $$;
revoke all on function public.claim_guest_mock(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_guest_mock(text,uuid,uuid) to service_role;
