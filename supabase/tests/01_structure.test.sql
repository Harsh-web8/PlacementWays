-- Structural guarantees that must never regress.
begin;

do $$
declare
  missing text;
begin
  -- Every public table has RLS enabled.
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform t.eq(coalesce(missing, 'none'), 'none', 'RLS enabled on every public table');

  -- Browser roles cannot write attempts/answers or forge scores.
  perform t.eq(has_table_privilege('authenticated', 'public.test_attempts',  'INSERT'), false, 'authenticated cannot INSERT test_attempts');
  perform t.eq(has_table_privilege('authenticated', 'public.test_attempts',  'UPDATE'), false, 'authenticated cannot UPDATE test_attempts');
  perform t.eq(has_table_privilege('authenticated', 'public.attempt_answers','INSERT'), false, 'authenticated cannot INSERT attempt_answers');
  perform t.eq(has_table_privilege('authenticated', 'public.attempt_answers','UPDATE'), false, 'authenticated cannot UPDATE attempt_answers');
  perform t.eq(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), false, 'authenticated cannot INSERT profiles');
  perform t.eq(has_table_privilege('authenticated', 'public.profiles', 'DELETE'), false, 'authenticated cannot DELETE profiles');

  -- Column-level protection on profiles.
  perform t.eq(has_column_privilege('authenticated', 'public.profiles', 'name', 'UPDATE'), true,  'authenticated can UPDATE profiles.name');
  perform t.eq(has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'), false, 'authenticated cannot UPDATE profiles.role');
  perform t.eq(has_column_privilege('authenticated', 'public.profiles', 'is_active', 'UPDATE'), false, 'authenticated cannot UPDATE profiles.is_active');
  perform t.eq(has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'), false, 'authenticated cannot UPDATE profiles.email');

  -- Anonymous visitors: public content only.
  perform t.eq(has_table_privilege('anon', 'public.questions', 'SELECT'), false, 'anon cannot read questions');
  perform t.eq(has_table_privilege('anon', 'public.profiles',  'SELECT'), false, 'anon cannot read profiles');
  perform t.eq(has_table_privilege('anon', 'public.audit_logs','SELECT'), false, 'anon cannot read audit_logs');
  perform t.eq(has_table_privilege('anon', 'public.companies', 'INSERT'), false, 'anon cannot write companies');
  perform t.eq(has_table_privilege('anon', 'public.companies', 'SELECT'), true,  'anon can read companies (RLS filters rows)');

  -- Trigger functions are not callable through the API.
  perform t.eq(has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), false, 'handle_new_user not executable by API roles');
  perform t.eq(has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'), true, 'is_admin executable (needed by policies)');
end $$;

rollback;
