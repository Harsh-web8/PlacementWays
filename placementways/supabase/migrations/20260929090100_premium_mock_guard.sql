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

  if exists(select 1 from public.mock_tests where id=p_test_id and not is_free) then
    raise exception 'Premium test access is not available yet' using errcode='42501';
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

  if not exists (select 1 from public.test_questions where test_id = p_test_id) then
    raise exception 'This test has no questions yet' using errcode = '23514';
  end if;

  -- A trigger rejects unpublished tests and sets the server-side deadline.
  insert into public.test_attempts (user_id, test_id) values (v_uid, p_test_id)
  returning id into v_id;
  return v_id;
end;
$$;
