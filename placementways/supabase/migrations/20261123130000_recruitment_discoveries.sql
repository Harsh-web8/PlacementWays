-- Milestone 4: monitor-discovered roles and hiring drives with explicit, audited approval.
-- Apply after 20261123110000_structured_recruitment_approvals.sql.

-- Discovery does not imply an open or future hiring window.
alter table public.recruitment_drives drop constraint recruitment_drives_drive_status_check;
alter table public.recruitment_drives add constraint recruitment_drives_drive_status_check
 check(drive_status in ('unknown','upcoming','open','closed','cancelled','completed'));
alter table public.recruitment_drives alter column drive_status set default 'unknown';

-- The same careers notice may be monitored for different roles/drives.
-- Reject only duplicate registrations of the same URL within the same scope.
alter table public.recruitment_watch_sources drop constraint recruitment_watch_sources_source_url_key;
create unique index recruitment_watch_source_scope_url on public.recruitment_watch_sources
 (company_id, source_url, coalesce(role_id::text,''), coalesce(drive_id::text,''));

alter table public.company_roles
 add column source_url text check(source_url is null or source_url ~ '^https://'),
 add column last_verified_at timestamptz;
alter table public.recruitment_drives
 add column source_url text check(source_url is null or source_url ~ '^https://');

create table public.recruitment_discovery_candidates (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null references public.recruitment_change_proposals(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 kind text not null check(kind in ('role','drive')),
 parent_role_id uuid references public.company_roles(id) on delete restrict,
 role_title text not null check(length(role_title) between 2 and 150),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 evidence_quote text not null check(length(evidence_quote) between 12 and 1500),
 dedupe_key text not null check(dedupe_key ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check(status in ('pending','approved','rejected','rolled_back')),
 created_role_id uuid references public.company_roles(id) on delete restrict,
 created_drive_id uuid references public.recruitment_drives(id) on delete restrict,
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(proposal_id,dedupe_key),
 check((kind='role' and parent_role_id is null) or (kind='drive' and parent_role_id is not null))
);
create index recruitment_discovery_pending on public.recruitment_discovery_candidates(status,created_at desc);
create index recruitment_discovery_company on public.recruitment_discovery_candidates(company_id,kind);
alter table public.recruitment_discovery_candidates enable row level security;
revoke all on public.recruitment_discovery_candidates from public,anon,authenticated;
grant select on public.recruitment_discovery_candidates to authenticated;
create policy discovery_admin_read on public.recruitment_discovery_candidates
 for select to authenticated using ((select public.is_admin()));
-- Only the service-role scan worker inserts candidates, and ONLY the decision RPC
-- transitions status/creates published guides. No client direct INSERT/UPDATE.

create or replace function public.decide_recruitment_discovery(p_candidate_id uuid, p_approve boolean)
returns text language plpgsql security definer set search_path='' as $$
declare
 c public.recruitment_discovery_candidates;
 p public.recruitment_change_proposals;
 created_role uuid; created_drive uuid; parent_role uuid;
 v_role jsonb; v_drive jsonb; v_title text; v_slug text;
begin
 if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into c from public.recruitment_discovery_candidates where id=p_candidate_id for update;
 if not found then raise exception 'Discovery candidate not found' using errcode='P0002'; end if;
 if c.status<>'pending' then return c.status; end if;
 select * into p from public.recruitment_change_proposals where id=c.proposal_id;
 if not found or p.company_id<>c.company_id then raise exception 'Invalid source scope' using errcode='23514'; end if;
 if position(c.evidence_quote in coalesce(p.observed_excerpt,p.evidence,''))=0 then
   raise exception 'Captured evidence no longer matches this candidate' using errcode='23514';
 end if;
 if p_approve then
   if not exists(select 1 from public.companies where id=c.company_id and status='published') then
     raise exception 'Publish the company first' using errcode='23514';
   end if;
   perform pg_advisory_xact_lock(hashtextextended('pw:discover:'||c.company_id::text,0));
   v_drive:=c.payload->'drive';
   if p.status='rejected' then raise exception 'Source proposal was rejected' using errcode='23514'; end if;
   if c.kind='role' then
     if p.role_id is not null or p.drive_id is not null then
       raise exception 'Role discovery must use a company-level source' using errcode='23514';
     end if;
     v_role:=c.payload->'role';
     v_title:=nullif(btrim(v_role->>'title'),'');
     v_slug:=lower(regexp_replace(v_title,'[^a-zA-Z0-9]+','-','g'));
     v_slug:=left(trim(both '-' from v_slug),90);
     if v_title is null or lower(btrim(c.role_title))<>lower(v_title) or length(v_title) not between 2 and 150 or
        v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
       raise exception 'Invalid discovered role title or slug' using errcode='23514';
     end if;
     if exists(select 1 from public.company_roles where company_id=c.company_id
       and (slug=v_slug or lower(btrim(title))=lower(v_title))) then
       raise exception 'Role already exists; review the existing guide instead' using errcode='23505';
     end if;
     insert into public.company_roles(company_id,slug,title,description,eligibility,salary_details,required_skills,status,source_url,last_verified_at)
     values(c.company_id,v_slug,v_title,v_role->>'description',v_role->>'eligibility',v_role->>'salary_details',
       coalesce(array(select jsonb_array_elements_text(v_role->'required_skills')),array[]::text[]),
       'published',p.source_url,now()) returning id into created_role;
     parent_role:=created_role;
   else
     if p.drive_id is not null or (p.role_id is not null and p.role_id<>c.parent_role_id) then
       raise exception 'Drive discovery is outside the monitored role scope' using errcode='23514';
     end if;
     select id into parent_role from public.company_roles where id=c.parent_role_id and company_id=c.company_id and status='published' for update;
     if parent_role is null then raise exception 'Parent role not published in this company' using errcode='23514'; end if;
     if not exists(select 1 from public.company_roles where id=parent_role and regexp_replace(lower(btrim(title)),'[^a-z0-9]+',' ','g')=regexp_replace(lower(btrim(c.role_title)),'[^a-z0-9]+',' ','g')) then
       raise exception 'Discovered role title does not match its parent role' using errcode='23514';
     end if;
   end if;
   if v_drive is not null then
     if jsonb_typeof(v_drive)<>'object' then raise exception 'Invalid drive record' using errcode='23514'; end if;
     v_title:=nullif(btrim(v_drive->>'title'),'');
     if v_title is null or length(v_title) not between 3 and 180 then
       raise exception 'Invalid drive title' using errcode='23514';
     end if;
     if exists(select 1 from public.recruitment_drives where role_id=parent_role and lower(btrim(title))=lower(v_title)) then
       raise exception 'Drive already exists; review that drive instead' using errcode='23505';
     end if;
     if v_drive->>'application_url' is not null and
       (v_drive->>'application_url') !~ '^https://[^[:space:]]+$' then
       raise exception 'Invalid HTTPS application URL' using errcode='23514';
     end if;
     insert into public.recruitment_drives(role_id,title,hiring_year,notes,application_url,status,drive_status,last_verified_at,source_url)
     values(parent_role,v_title,(v_drive->>'hiring_year')::integer,v_drive->>'notes',v_drive->>'application_url',
       'published','unknown',now(),p.source_url) returning id into created_drive;
   end if;
   if c.kind='drive' and created_drive is null then raise exception 'Missing drive payload' using errcode='23514'; end if;
 end if;
 update public.recruitment_discovery_candidates
  set status=case when p_approve then 'approved' else 'rejected' end,
   reviewed_by=auth.uid(),reviewed_at=now(),created_role_id=created_role,created_drive_id=created_drive
  where id=c.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id)
  values(auth.uid(),case when p_approve then 'recruitment.discovery_approved' else 'recruitment.discovery_rejected' end,'recruitment_discovery_candidate',c.id::text);
 return case when p_approve then 'approved' else 'rejected' end;
end $$;
revoke all on function public.decide_recruitment_discovery(uuid,boolean) from public,anon;
grant execute on function public.decide_recruitment_discovery(uuid,boolean) to authenticated;

-- Rollback guards against deleting any role/drive that subsequently gained other data.
create function public.rollback_recruitment_discovery(p_candidate_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare c public.recruitment_discovery_candidates;
begin
 if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into c from public.recruitment_discovery_candidates where id=p_candidate_id for update;
 if not found or c.status<>'approved' then raise exception 'Approved candidate not found' using errcode='P0002'; end if;
 if c.created_drive_id is not null then
  if exists(select 1 from public.recruitment_rounds where drive_id=c.created_drive_id) or
     exists(select 1 from public.recruitment_watch_sources where drive_id=c.created_drive_id) or
     exists(select 1 from public.recruitment_change_proposals where drive_id=c.created_drive_id) or
     exists(select 1 from public.recruitment_updates where drive_id=c.created_drive_id) then
    raise exception 'Drive has dependent recruitment content; archive it manually' using errcode='23514';
  end if;
  update public.recruitment_discovery_candidates set created_drive_id=null where id=c.id;
  delete from public.recruitment_drives where id=c.created_drive_id;
 end if;
 if c.created_role_id is not null then
  if exists(select 1 from public.recruitment_drives where role_id=c.created_role_id) or
     exists(select 1 from public.recruitment_watch_sources where role_id=c.created_role_id) or
     exists(select 1 from public.recruitment_change_proposals where role_id=c.created_role_id) or
     exists(select 1 from public.recruitment_updates where role_id=c.created_role_id) then
    raise exception 'Role has dependent content; archive it manually' using errcode='23514';
  end if;
  update public.recruitment_discovery_candidates set created_role_id=null where id=c.id;
  delete from public.company_roles where id=c.created_role_id;
 end if;
 update public.recruitment_discovery_candidates set status='rolled_back' where id=c.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id)
 values(auth.uid(),'recruitment.discovery_rolled_back','recruitment_discovery_candidate',c.id::text);
 return 'rolled_back';
end $$;
revoke all on function public.rollback_recruitment_discovery(uuid) from public,anon;
grant execute on function public.rollback_recruitment_discovery(uuid) to authenticated;

-- Monitoring attempts and backoff metadata (worker uses a bounded scheduler).
alter table public.recruitment_watch_sources
 add column next_check_at timestamptz,
 add column last_success_at timestamptz,
 add column consecutive_failures integer not null default 0 check(consecutive_failures>=0),
 add column poll_interval_minutes integer not null default 360 check(poll_interval_minutes between 30 and 10080);
create index recruitment_watch_next_check on public.recruitment_watch_sources(next_check_at)
 where enabled=true;

-- Leased claims prevent overlapping cron invocations from scanning the same source.
-- Only the server's service_role may execute this function.
create function public.claim_recruitment_watch_sources(p_limit integer default 4)
returns setof public.recruitment_watch_sources
language sql security definer set search_path='' as $$
 with ready as (
  select id from public.recruitment_watch_sources
  where enabled=true and (next_check_at is null or next_check_at<=now())
  order by next_check_at asc nulls first, created_at asc
  for update skip locked
  limit least(greatest(p_limit,1),25)
 )
 update public.recruitment_watch_sources s set next_check_at=now()+interval '3 minutes'
 from ready where s.id=ready.id returning s.*;
$$;
revoke all on function public.claim_recruitment_watch_sources(integer) from public,anon,authenticated;
grant execute on function public.claim_recruitment_watch_sources(integer) to service_role;

alter table public.recruitment_watch_sources
 add column last_ai_fingerprint text check(last_ai_fingerprint is null or last_ai_fingerprint ~ '^[a-f0-9]{64}$');
