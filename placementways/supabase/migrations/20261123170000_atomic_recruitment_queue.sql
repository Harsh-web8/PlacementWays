-- Fresh Supabase projects require explicit grants for the monitor's Data API calls.
grant select on public.company_roles, public.recruitment_drives, public.recruitment_rounds
  to service_role;
grant select on public.companies, public.site_settings, public.worker_heartbeats to service_role;
grant select, update on public.recruitment_watch_sources to service_role;
grant select (watch_source_id, fingerprint, previous_excerpt)
  on public.recruitment_change_proposals to service_role;

-- Serialize with the approval RPC on the proposal row. A reviewer sees either
-- the complete extraction or the preceding version, even during an AI retry.
create function public.queue_recruitment_scan(
  p_source_id uuid, p_fingerprint text, p_excerpt text, p_previous_excerpt text,
  p_item jsonb, p_field_changes jsonb, p_discoveries jsonb, p_ai_parsed boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  source public.recruitment_watch_sources;
  proposal public.recruitment_change_proposals;
  has_suggestions boolean := jsonb_array_length(p_field_changes) > 0
    or jsonb_array_length(p_discoveries) > 0;
begin
  select * into source from public.recruitment_watch_sources where id=p_source_id and enabled;
  if not found then return false; end if;

  insert into public.recruitment_change_proposals
    (watch_source_id,company_id,role_id,drive_id,fingerprint,source_url,headline,summary,
     evidence,observed_excerpt,previous_excerpt,classification,confidence,extraction_status)
  values
    (source.id,source.company_id,source.role_id,source.drive_id,p_fingerprint,source.source_url,
     p_item->>'headline',p_item->>'summary',p_item->>'evidence',p_excerpt,p_previous_excerpt,
     p_item->>'classification','requires_review','no_structured_changes')
  on conflict (watch_source_id,fingerprint) do nothing;

  select * into proposal from public.recruitment_change_proposals
    where watch_source_id=source.id and fingerprint=p_fingerprint for update;
  if proposal.status is distinct from 'pending' then return false; end if;

  insert into public.recruitment_field_changes
    (proposal_id,target_kind,target_id,field_key,old_value,new_value,evidence_quote)
  select proposal.id, f.target_kind, f.target_id, f.field_key, f.old_value, f.new_value, f.evidence_quote
    from jsonb_to_recordset(p_field_changes) as f(
      target_kind text,target_id uuid,field_key text,old_value jsonb,new_value jsonb,evidence_quote text)
  on conflict (proposal_id,target_kind,target_id,field_key) do nothing;

  insert into public.recruitment_discovery_candidates
    (proposal_id,company_id,parent_role_id,kind,role_title,payload,evidence_quote,dedupe_key)
  select proposal.id, source.company_id, d.parent_role_id, d.kind, d.role_title, d.payload, d.evidence_quote, d.dedupe_key
    from jsonb_to_recordset(p_discoveries) as d(
      parent_role_id uuid,kind text,role_title text,payload jsonb,evidence_quote text,dedupe_key text)
  on conflict (proposal_id,dedupe_key) do nothing;

  if p_ai_parsed and proposal.extraction_status='no_structured_changes' then
    update public.recruitment_change_proposals
      set headline=p_item->>'headline',summary=p_item->>'summary',evidence=p_item->>'evidence',
          classification=p_item->>'classification',
          extraction_status=case when has_suggestions then 'suggested' else extraction_status end
      where id=proposal.id;
  end if;
  return true;
end $$;

revoke all on function public.queue_recruitment_scan(uuid,text,text,text,jsonb,jsonb,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function public.queue_recruitment_scan(uuid,text,text,text,jsonb,jsonb,jsonb,boolean)
  to service_role;
