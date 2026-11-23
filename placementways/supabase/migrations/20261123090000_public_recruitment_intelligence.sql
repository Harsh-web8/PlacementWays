-- PlacementWays public-first launch and recruitment intelligence, 23 November 2026.
-- Apply AFTER the existing 20261002094000 migration; preserves existing data.

-- Public launch: old paid content becomes free. Enforce until the business decides to
-- launch payments, rather than merely hiding paid buttons in the frontend.
update public.courses set is_free=true, price_paise=0 where not is_free or price_paise<>0;
update public.mock_tests set is_free=true, access_type='PUBLIC', guest_attempt_allowed=true,
 guest_attempt_limit=100, price_paise=0
 where not is_free or access_type<>'PUBLIC' or not guest_attempt_allowed or guest_attempt_limit<>100 or price_paise<>0;
update public.site_settings set guest_mock_enabled=true, guest_mock_limit=100,
 guest_network_daily_limit=100 where id=true;

create or replace function public.enforce_public_launch_course() returns trigger
language plpgsql set search_path='' as $$ begin
 new.is_free:=true; new.price_paise:=0; return new;
end $$;
create trigger public_launch_course before insert or update on public.courses
 for each row execute function public.enforce_public_launch_course();
create or replace function public.enforce_public_launch_mock() returns trigger
language plpgsql set search_path='' as $$ begin
 new.is_free:=true; new.access_type:='PUBLIC'; new.price_paise:=0;
 new.guest_attempt_allowed:=true; new.guest_attempt_limit:=100;
 return new;
end $$;
-- Existing sync_mock_access trigger is also BEFORE; enforcing free access after it
-- matters for future writes. Trigger name sorts after sync_mock_access.
create trigger zz_public_launch_mock before insert or update on public.mock_tests
 for each row execute function public.enforce_public_launch_mock();
revoke all on function public.enforce_public_launch_course(), public.enforce_public_launch_mock() from public,anon,authenticated;

-- A role has a durable identity; a drive is one particular hiring cycle.
create table public.company_roles (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 slug text not null check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 title text not null check(length(title) between 2 and 150),
 description text,
 responsibilities text,
 salary_details text,
 eligibility text,
 required_skills text[] not null default '{}',
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(),
 unique(company_id,slug)
);
create table public.recruitment_drives (
 id uuid primary key default gen_random_uuid(),
 role_id uuid not null references public.company_roles(id) on delete cascade,
 title text not null check(length(title) between 3 and 180),
 hiring_year integer check(hiring_year between 2000 and 2100),
 drive_status text not null default 'upcoming' check(drive_status in ('upcoming','open','closed','cancelled','completed')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 application_url text check(application_url is null or application_url ~ '^https://'),
 opens_at timestamptz, closes_at timestamptz,
 notes text,
 last_verified_at timestamptz,
 created_at timestamptz not null default now(),
 unique(role_id,title),
 check(opens_at is null or closes_at is null or closes_at>=opens_at)
);
create table public.recruitment_rounds (
 id uuid primary key default gen_random_uuid(),
 drive_id uuid not null references public.recruitment_drives(id) on delete cascade,
 round_number integer not null check(round_number between 1 and 30),
 name text not null check(length(name) between 2 and 150),
 round_type text not null default 'assessment' check(round_type in ('screening','assessment','coding','interview','hr','other')),
 description text,
 topics text[] not null default '{}',
 question_count integer check(question_count between 0 and 10000),
 duration_minutes integer check(duration_minutes between 1 and 1440),
 marking_rules text,
 source_url text check(source_url is null or source_url ~ '^https://'),
 source_kind text not null default 'unverified' check(source_kind in ('official','secondary','candidate_reported','historical','unverified')),
 unique(drive_id,round_number)
);

-- The monitoring registry is ADMIN ONLY, even for reads. No anonymous source
-- editing, and no service-role credentials in browser requests.
create table public.recruitment_watch_sources (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 role_id uuid references public.company_roles(id) on delete set null,
 drive_id uuid references public.recruitment_drives(id) on delete set null,
 label text not null check(length(label) between 3 and 140),
 source_url text not null unique check(source_url ~ '^https://'),
 enabled boolean not null default true,
 last_checked_at timestamptz,
 last_fingerprint text,
 last_excerpt text,
 last_error text,
 created_at timestamptz not null default now()
);
create table public.recruitment_change_proposals (
 id uuid primary key default gen_random_uuid(),
 watch_source_id uuid not null references public.recruitment_watch_sources(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 role_id uuid references public.company_roles(id) on delete set null,
 drive_id uuid references public.recruitment_drives(id) on delete set null,
 fingerprint text not null check(length(fingerprint)=64),
 headline text not null check(length(headline) between 3 and 200),
 summary text not null check(length(summary) between 1 and 5000),
 evidence text not null check(length(evidence) between 1 and 4000),
 previous_excerpt text,
 source_url text not null check(source_url ~ '^https://'),
 classification text not null default 'source_change',
 confidence text not null default 'requires_review' check(confidence in ('requires_review','high','medium','low')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 detected_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id),
 unique(watch_source_id,fingerprint)
);
create table public.recruitment_updates (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references public.recruitment_change_proposals(id),
 company_id uuid not null references public.companies(id) on delete cascade,
 role_id uuid references public.company_roles(id) on delete set null,
 drive_id uuid references public.recruitment_drives(id) on delete set null,
 headline text not null,
 summary text not null,
 source_url text not null,
 approved_by uuid not null references public.profiles(id),
 published_at timestamptz not null default now()
);

-- All new tables have RLS even for the service role worker.
do $$ declare t text; begin
 foreach t in array array['company_roles','recruitment_drives','recruitment_rounds',
 'recruitment_watch_sources','recruitment_change_proposals','recruitment_updates'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;

grant select on public.company_roles, public.recruitment_drives, public.recruitment_rounds, public.recruitment_updates to anon,authenticated;
create policy roles_public_read on public.company_roles for select using (
 (status='published' and exists(select 1 from public.companies c where c.id=company_id and c.status='published'))
 or (select public.is_admin()));
create policy drives_public_read on public.recruitment_drives for select using (
 (status='published' and exists(select 1 from public.company_roles r where r.id=role_id and r.status='published'))
 or (select public.is_admin()));
create policy rounds_public_read on public.recruitment_rounds for select using (
 exists(select 1 from public.recruitment_drives d where d.id=drive_id)
 or (select public.is_admin()));
create policy updates_public_read on public.recruitment_updates for select using (
 exists(select 1 from public.companies c where c.id=company_id and c.status='published')
 or (select public.is_admin()));

do $$ declare t text; begin
 foreach t in array array['company_roles','recruitment_drives','recruitment_rounds','recruitment_watch_sources','recruitment_change_proposals'] loop
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t||'_admin',t);
 end loop;
end $$;
-- Published updates may ONLY be created by the security-definer approval RPC.
-- Admins can view but cannot independently insert unapproved posts.

-- Atomic, idempotent, audited publication. Cannot be invoked by anon users.
create function public.approve_recruitment_proposal(p_proposal_id uuid,p_approve boolean)
returns text language plpgsql security definer set search_path='' as $$
declare p public.recruitment_change_proposals;
begin
 if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into p from public.recruitment_change_proposals where id=p_proposal_id for update;
 if not found then raise exception 'Proposal not found' using errcode='P0002'; end if;
 if p.status<>'pending' then return p.status; end if;
 if p_approve and not exists(select 1 from public.companies where id=p.company_id and status='published') then
  raise exception 'Publish the company before its recruitment update' using errcode='23514';
 end if;
 update public.recruitment_change_proposals set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_at=now(),reviewed_by=auth.uid() where id=p.id;
 if p_approve then
  insert into public.recruitment_updates(proposal_id,company_id,role_id,drive_id,headline,summary,source_url,approved_by)
  values(p.id,p.company_id,p.role_id,p.drive_id,p.headline,p.summary,p.source_url,auth.uid());
 end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id)
 values(auth.uid(),case when p_approve then 'recruitment.approve' else 'recruitment.reject' end,'recruitment_change_proposal',p.id::text);
 return case when p_approve then 'approved' else 'rejected' end;
end $$;
revoke all on function public.approve_recruitment_proposal(uuid,boolean) from public,anon;
grant execute on function public.approve_recruitment_proposal(uuid,boolean) to authenticated;

create index recruitment_updates_recent on public.recruitment_updates(published_at desc);
create index recruitment_drives_role on public.recruitment_drives(role_id,status);
create index recruitment_watch_enabled on public.recruitment_watch_sources(enabled,last_checked_at);
create index recruitment_proposal_pending on public.recruitment_change_proposals(status,detected_at desc);

-- Anonymous practice checks: do not reveal solution keys through public RLS.
-- The service-role gateway has a daily request budget and blocks a guest from
-- checking answers to their own active timed mock using the same guest token.
create table public.guest_practice_rate_limits (
 network_hash text primary key check(network_hash ~ '^[a-f0-9]{64}$'),
 attempts integer not null default 0,
 expires_at timestamptz not null default now()+interval '2 days'
);
alter table public.guest_practice_rate_limits enable row level security;
revoke all on public.guest_practice_rate_limits from anon,authenticated;

create function public.guest_practice_answer(
 p_question_id uuid, p_answer text, p_token_hash text, p_network_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.questions; n integer;
begin
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
 or p_network_hash is null or p_network_hash !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid guest session' using errcode='22023';
 end if;
 if p_answer is null or length(p_answer) not between 1 and 64 then
  raise exception 'Invalid answer' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('pw:practice:'||p_network_hash,0));
 delete from public.guest_practice_rate_limits where expires_at<now();
 insert into public.guest_practice_rate_limits(network_hash) values(p_network_hash) on conflict do nothing;
 select attempts into n from public.guest_practice_rate_limits where network_hash=p_network_hash for update;
 if n>=100 then raise exception 'Daily practice checking limit reached' using errcode='P0001'; end if;
 select * into q from public.questions where id=p_question_id and status='published' and is_practice and question_type='mcq';
 if not found then raise exception 'Question unavailable' using errcode='P0002'; end if;
 if not exists(select 1 from public.question_options where question_id=q.id and option_key=p_answer) then
  raise exception 'Invalid option' using errcode='22023';
 end if;
 -- Checking the answer from the same browser during its own timed mock is blocked.
 if exists(select 1 from public.guest_mock_sessions g
  join public.test_attempts a on a.guest_id=g.id
  join public.test_questions tq on tq.test_id=a.test_id
  where g.token_hash=p_token_hash and a.status='in_progress'
  and now()<=a.expires_at+public.attempt_grace() and tq.question_id=q.id)
 then raise exception 'Finish your timed mock before checking this solution' using errcode='23514'; end if;
 update public.guest_practice_rate_limits set attempts=attempts+1 where network_hash=p_network_hash;
 return jsonb_build_object('correct',q.correct_answer=p_answer,'correct_answer',q.correct_answer,
  'explanation',coalesce(q.explanation,''));
end $$;
revoke all on function public.guest_practice_answer(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.guest_practice_answer(uuid,text,text,text) to service_role;
