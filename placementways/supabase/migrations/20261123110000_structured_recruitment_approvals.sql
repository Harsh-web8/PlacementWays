-- PlacementWays M02: reviewed, field-level changes with optimistic concurrency and rollback.
-- Depends on 20261123090000_public_recruitment_intelligence.sql.
-- No AI/service-role worker receives direct UPDATE permissions via the new approval RPCs.

alter table public.recruitment_change_proposals
  add column observed_excerpt text,
  add column extraction_status text not null default 'not_extracted'
    check (extraction_status in ('not_extracted','suggested','no_structured_changes','failed'));

alter table public.recruitment_updates
  add column is_current boolean not null default true,
  add column structured_change_count integer not null default 0;

create table public.recruitment_field_changes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.recruitment_change_proposals(id) on delete cascade,
  target_kind text not null check (target_kind in ('role','drive','round','round_new')),
  target_id uuid not null,
  field_key text not null,
  old_value jsonb,
  new_value jsonb not null,
  evidence_quote text not null check (length(evidence_quote) between 8 and 1500),
  created_at timestamptz not null default now(),
  unique (proposal_id,target_kind,target_id,field_key),
  constraint recruitment_patch_fields check (
    (target_kind='role' and field_key in ('title','description','responsibilities','salary_details','eligibility','required_skills'))
    or (target_kind='drive' and field_key in ('title','notes','application_url','opens_at','closes_at','drive_status'))
    or (target_kind='round' and field_key in ('name','round_type','description','topics','question_count','duration_minutes','marking_rules'))
    or (target_kind='round_new' and field_key ~ '^create_([1-9]|[12][0-9]|30)$')
  ),
  constraint recruitment_patch_value_types check (
    (target_kind='round_new' and jsonb_typeof(new_value)='object') or
    (field_key in ('required_skills','topics') and jsonb_typeof(new_value)='array') or
    (field_key in ('question_count','duration_minutes') and jsonb_typeof(new_value) in ('number','null')) or
    (target_kind<>'round_new' and field_key not in ('required_skills','topics','question_count','duration_minutes') and jsonb_typeof(new_value) in ('string','null'))
  )
);

create table public.recruitment_field_history (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.recruitment_change_proposals(id),
  target_kind text not null,
  target_id uuid not null,
  field_key text not null,
  previous_value jsonb,
  applied_value jsonb,
  applied_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references public.profiles(id),
  unique (proposal_id,target_kind,target_id,field_key)
);

alter table public.recruitment_field_changes enable row level security;
alter table public.recruitment_field_history enable row level security;
revoke all on public.recruitment_field_changes,public.recruitment_field_history from anon,authenticated;
grant select,insert,update,delete on public.recruitment_field_changes to authenticated;
grant select on public.recruitment_field_history to authenticated;
create policy recruitment_patches_admin on public.recruitment_field_changes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy recruitment_history_admin on public.recruitment_field_history
  for select to authenticated using ((select public.is_admin()));
create index recruitment_field_changes_proposal on public.recruitment_field_changes(proposal_id);
create index recruitment_field_history_proposal on public.recruitment_field_history(proposal_id,id desc);

-- Admin-only, transactional, optimistic concurrency. A stale proposed old value
-- aborts the WHOLE publication, preserving all previous values.
create or replace function public.approve_recruitment_proposal(p_proposal_id uuid,p_approve boolean)
returns text language plpgsql security definer set search_path='' as $$
declare
 p public.recruitment_change_proposals;
 c public.recruitment_field_changes;
 t text;
 current_value jsonb;
 expected_old_value jsonb;
 applied_value jsonb;
 inserted_round public.recruitment_rounds;
 change_count integer := 0;
begin
 if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into p from public.recruitment_change_proposals where id=p_proposal_id for update;
 if not found then raise exception 'Proposal not found' using errcode='P0002'; end if;
 if p.status<>'pending' then return p.status; end if;
 if p_approve and not exists(select 1 from public.companies where id=p.company_id and status='published') then
  raise exception 'Publish the company before this update' using errcode='23514';
 end if;
 if p_approve then
  for c in select * from public.recruitment_field_changes where proposal_id=p.id order by
    case target_kind when 'role' then 1 when 'drive' then 2 when 'round' then 3 else 4 end, field_key, id
  loop
   if position(c.evidence_quote in coalesce(p.observed_excerpt,p.evidence,''))=0 then
    raise exception 'Evidence for a proposed field is not in the captured source snapshot' using errcode='23514';
   end if;
   if c.target_kind='role' then
    if p.role_id is null or c.target_id<>p.role_id or not exists
      (select 1 from public.company_roles where id=c.target_id and company_id=p.company_id) then
      raise exception 'Role field is outside proposal scope' using errcode='23514';
    end if;
    t:='company_roles';
   elsif c.target_kind='drive' then
    if p.drive_id is null or c.target_id<>p.drive_id or not exists
      (select 1 from public.recruitment_drives d join public.company_roles r on r.id=d.role_id
       where d.id=c.target_id and r.id=p.role_id and r.company_id=p.company_id) then
      raise exception 'Drive field is outside proposal scope' using errcode='23514';
    end if;
    t:='recruitment_drives';
   elsif c.target_kind='round' then
    if p.drive_id is null or not exists
      (select 1 from public.recruitment_rounds rr join public.recruitment_drives d on d.id=rr.drive_id
       join public.company_roles r on r.id=d.role_id
       where rr.id=c.target_id and d.id=p.drive_id and r.id=p.role_id and r.company_id=p.company_id) then
      raise exception 'Round field is outside proposal scope' using errcode='23514';
    end if;
    t:='recruitment_rounds';
   else
    if p.drive_id is null or c.target_id<>p.drive_id or not exists
      (select 1 from public.recruitment_drives d join public.company_roles r on r.id=d.role_id
       where d.id=c.target_id and r.id=p.role_id and r.company_id=p.company_id) then
      raise exception 'New round is outside proposal scope' using errcode='23514';
    end if;
    if c.new_value->>'name' is null or c.new_value->>'round_number' is null
       or c.field_key<>('create_' || (c.new_value->>'round_number')) then
      raise exception 'New round requires a consistent round number and name' using errcode='23514';
    end if;
    insert into public.recruitment_rounds
      (drive_id,round_number,name,round_type,description,topics,question_count,duration_minutes,marking_rules,source_url,source_kind)
    values (p.drive_id,(c.new_value->>'round_number')::integer,c.new_value->>'name',
      coalesce(c.new_value->>'round_type','assessment'),c.new_value->>'description',
      coalesce(array(select jsonb_array_elements_text(c.new_value->'topics')),array[]::text[]),
      (c.new_value->>'question_count')::integer,(c.new_value->>'duration_minutes')::integer,
      c.new_value->>'marking_rules',p.source_url,'unverified') returning * into inserted_round;
    insert into public.recruitment_field_history(proposal_id,target_kind,target_id,field_key,previous_value,applied_value)
      values (p.id,'round_new',inserted_round.id,'create',null,to_jsonb(inserted_round));
    change_count:=change_count+1;
    continue;
   end if;
   -- Table and column identifiers come ONLY from database CHECK-constrained allowlists above.
   execute format('select to_jsonb(x)->%L from public.%I x where id=$1 for update',c.field_key,t)
     into current_value using c.target_id;
   -- Normalize old timestamps/nulls to the column type before concurrency comparison.
   execute format('select to_jsonb(jsonb_populate_record(null::public.%I,jsonb_build_object($1,$2)))->%L',
     t,c.field_key) into expected_old_value using c.field_key,coalesce(c.old_value,'null'::jsonb);
   if current_value is distinct from expected_old_value then
    raise exception 'Conflicting or stale % field: refresh the proposal before approving',c.field_key using errcode='40001';
   end if;
   execute format('update public.%I set %I=(select %I from jsonb_populate_record(null::public.%I,jsonb_build_object($1,$2))) where id=$3',
      t,c.field_key,c.field_key,t) using c.field_key,c.new_value,c.target_id;
   execute format('select to_jsonb(x)->%L from public.%I x where id=$1',c.field_key,t)
     into applied_value using c.target_id;
   insert into public.recruitment_field_history(proposal_id,target_kind,target_id,field_key,previous_value,applied_value)
     values (p.id,c.target_kind,c.target_id,c.field_key,current_value,applied_value);
   change_count:=change_count+1;
  end loop;
  -- Provenance is itself versioned for any edited selection round.
  for c in select distinct on (target_id) * from public.recruitment_field_changes
    where proposal_id=p.id and target_kind='round' order by target_id,id
  loop
   execute 'select to_jsonb(source_url),to_jsonb(source_kind) from public.recruitment_rounds where id=$1 for update'
      into current_value,applied_value using c.target_id;
   if current_value is distinct from to_jsonb(p.source_url) then
    update public.recruitment_rounds set source_url=p.source_url where id=c.target_id;
    insert into public.recruitment_field_history(proposal_id,target_kind,target_id,field_key,previous_value,applied_value)
      values(p.id,'round',c.target_id,'source_url',current_value,to_jsonb(p.source_url));
   end if;
   if applied_value is distinct from '"unverified"'::jsonb then
    update public.recruitment_rounds set source_kind='unverified' where id=c.target_id;
    insert into public.recruitment_field_history(proposal_id,target_kind,target_id,field_key,previous_value,applied_value)
      values(p.id,'round',c.target_id,'source_kind',applied_value,'"unverified"'::jsonb);
   end if;
  end loop;
  if change_count>0 and p.drive_id is not null then
    select to_jsonb(last_verified_at) into current_value from public.recruitment_drives
      where id=p.drive_id for update;
    update public.recruitment_drives set last_verified_at=now() where id=p.drive_id;
    select to_jsonb(last_verified_at) into applied_value from public.recruitment_drives where id=p.drive_id;
    insert into public.recruitment_field_history(proposal_id,target_kind,target_id,field_key,previous_value,applied_value)
      values(p.id,'drive',p.drive_id,'last_verified_at',current_value,applied_value);
  end if;
 end if;
 update public.recruitment_change_proposals set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_at=now(),reviewed_by=auth.uid() where id=p.id;
 if p_approve then
  insert into public.recruitment_updates(proposal_id,company_id,role_id,drive_id,headline,summary,source_url,approved_by,structured_change_count)
  values (p.id,p.company_id,p.role_id,p.drive_id,p.headline,p.summary,p.source_url,auth.uid(),change_count);
 end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id)
 values(auth.uid(),case when p_approve then 'recruitment.approve_structured' else 'recruitment.reject' end,'recruitment_change_proposal',p.id::text);
 return case when p_approve then 'approved' else 'rejected' end;
end $$;
revoke all on function public.approve_recruitment_proposal(uuid,boolean) from public,anon;
grant execute on function public.approve_recruitment_proposal(uuid,boolean) to authenticated;

-- Roll back exactly the approved changes, if no subsequent update changed them.
-- All history entries are checked before reverting; conflicts abort the transaction.
create function public.rollback_recruitment_proposal(p_proposal_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare p public.recruitment_change_proposals; h public.recruitment_field_history;
 t text; current_value jsonb; current_round jsonb;
begin
 if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into p from public.recruitment_change_proposals where id=p_proposal_id for update;
 if not found or p.status<>'approved' then raise exception 'Approved proposal not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.recruitment_updates where proposal_id=p.id and is_current) then
  return 'already_rolled_back';
 end if;
 for h in select * from public.recruitment_field_history where proposal_id=p.id order by id desc loop
  if h.reverted_at is not null then raise exception 'Proposal history already reverted' using errcode='23514'; end if;
  if h.target_kind='round_new' then
   select to_jsonb(r) into current_round from public.recruitment_rounds r where id=h.target_id for update;
   if current_round is distinct from h.applied_value then
    raise exception 'Round changed since publication. Cannot roll back safely' using errcode='40001';
   end if;
   delete from public.recruitment_rounds where id=h.target_id;
  else
   t:=case h.target_kind when 'role' then 'company_roles' when 'drive' then 'recruitment_drives' else 'recruitment_rounds' end;
   execute format('select to_jsonb(x)->%L from public.%I x where id=$1 for update',h.field_key,t)
     into current_value using h.target_id;
   if current_value is distinct from h.applied_value then
    raise exception 'Field changed since publication. Cannot roll back safely' using errcode='40001';
   end if;
   execute format('update public.%I set %I=(select %I from jsonb_populate_record(null::public.%I,jsonb_build_object($1,$2))) where id=$3',
     t,h.field_key,h.field_key,t) using h.field_key,coalesce(h.previous_value,'null'::jsonb),h.target_id;
  end if;
  update public.recruitment_field_history set reverted_at=now(),reverted_by=auth.uid() where id=h.id;
 end loop;
 update public.recruitment_updates set is_current=false where proposal_id=p.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id)
 values(auth.uid(),'recruitment.rollback','recruitment_change_proposal',p.id::text);
 return 'rolled_back';
end $$;
revoke all on function public.rollback_recruitment_proposal(uuid) from public,anon;
grant execute on function public.rollback_recruitment_proposal(uuid) to authenticated;

-- Retracted updates are private to administrators, not public feed entries.
drop policy if exists updates_public_read on public.recruitment_updates;
create policy updates_public_read on public.recruitment_updates for select using (
 (is_current and exists(select 1 from public.companies c where c.id=company_id and c.status='published'))
 or (select public.is_admin()));
grant update on public.recruitment_updates to authenticated;
-- RLS deliberately does NOT allow direct admin UPDATE of updates: rollback RPC only.

-- Only the security-definer decision function can transition proposal status.
-- Monitoring workers insert/update as service_role (server-side), never from browser.
revoke insert,update,delete on public.recruitment_change_proposals from authenticated;

-- Prevent edits slipping in after approval (including a racing admin form submit).
create function public.recruitment_patch_pending_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare proposed_id uuid; proposed_status text;
begin
 if tg_op='DELETE' then proposed_id:=old.proposal_id;
 else proposed_id:=new.proposal_id; end if;
 if tg_op='UPDATE' and new.proposal_id<>old.proposal_id then
  raise exception 'Cannot move a field change between proposals' using errcode='23514';
 end if;
 select status into proposed_status from public.recruitment_change_proposals
  where id=proposed_id for update;
 if proposed_status is distinct from 'pending' then
  raise exception 'Only pending proposals can have their field changes edited' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger recruitment_patch_pending_before_write
 before insert or update or delete on public.recruitment_field_changes
 for each row execute function public.recruitment_patch_pending_guard();
revoke all on function public.recruitment_patch_pending_guard() from public,anon,authenticated;
