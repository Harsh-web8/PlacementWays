-- LOCAL TEST HARNESS ONLY -- never run this against a real Supabase project.
--
-- Real Supabase already provides: the `auth` schema (auth.users, auth.uid()),
-- the anon / authenticated / service_role roles, and default table privileges.
-- To test our migrations against plain PostgreSQL we recreate the minimum of
-- that environment here, as faithfully as we can.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant anon, authenticated, service_role to postgres;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same contract as Supabase: reads the `sub` claim of the request JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase's default: every new public table/function/sequence is granted to
-- the API roles. Our migrations deliberately revoke this; the stub reproduces
-- the "before" state so the revoke is actually exercised.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Test helpers ---------------------------------------------------------
create schema if not exists t;
grant usage on schema t to public;

-- Runs `stmt` and passes only if it raises the expected SQLSTATE.
create or replace function t.throws(stmt text, expected_state text, label text default '')
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then
      raise notice 'ok   - % (raised %)', label, sqlstate;
      return;
    end if;
    raise exception 'FAIL - %: expected SQLSTATE %, got % (%)', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL - %: statement succeeded but should have failed', label;
end $$;

create or replace function t.eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is not distinct from expected then
    raise notice 'ok   - %', label;
  else
    raise exception 'FAIL - %: expected %, got %', label, expected, actual;
  end if;
end $$;
