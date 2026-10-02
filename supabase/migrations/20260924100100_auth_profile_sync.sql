-- =====================================================================
-- PlacementWays -- Phase 3, migration 2: auth <-> profile sync
--
-- SECURITY NOTE
--   Anyone can call supabase.auth.signUp() from a browser with any
--   `options.data` they like (that becomes raw_user_meta_data). We therefore
--   NEVER read a role from metadata. Every new account is a 'student'.
--   Promotion to admin is a deliberate, privileged action (see README).
-- =====================================================================

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(
    btrim(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),   -- Google login (future)
        split_part(new.email, '@', 1)
      )
    ),
    100
  );

  insert into public.profiles (id, email, name, role)
  values (new.id, lower(new.email), v_name, 'student');

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step when a user confirms an email change.
create function public.handle_user_email_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Used by RLS policies. SECURITY DEFINER so evaluating it does not itself
-- trigger RLS on profiles (which would recurse). It answers one narrow
-- question -- "is the caller an active admin?" -- and reveals nothing else.
create function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active
  )
$$;

-- Trigger functions must not be callable through the API.
revoke all on function public.handle_new_user()          from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;
-- is_admin() is evaluated inside policies for API roles, so they need EXECUTE.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
