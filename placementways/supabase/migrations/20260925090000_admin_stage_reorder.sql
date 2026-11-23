-- =====================================================================
-- PlacementWays -- Phase 4: atomic stage reorder
--
-- The admin "move stage up / down" action swaps two rows' stage_order.
-- Two separate PostgREST requests can't do this: the UNIQUE constraint on
-- (recruitment_process_id, stage_order) is deferred to COMMIT, but each
-- plain REST call is its own single-statement transaction, so the second
-- row hasn't moved yet when the first row's new value is checked.
--
-- A single SQL function runs both UPDATEs in one transaction, which is
-- exactly what that constraint's DEFERRABLE was added for (see migration 1).
-- SECURITY INVOKER (the default): the UPDATEs still run as the calling
-- user, so Row Level Security still requires an admin -- this function
-- grants no new access, it only makes an already-allowed change atomic.
-- =====================================================================

create function public.move_process_stage(p_stage_id uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_process_id     uuid;
  v_order          integer;
  v_neighbor_id    uuid;
  v_neighbor_order integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be ''up'' or ''down''' using errcode = '22023';
  end if;

  select recruitment_process_id, stage_order into v_process_id, v_order
  from public.process_stages
  where id = p_stage_id;

  if v_process_id is null then
    raise exception 'Stage not found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select id, stage_order into v_neighbor_id, v_neighbor_order
    from public.process_stages
    where recruitment_process_id = v_process_id and stage_order < v_order
    order by stage_order desc
    limit 1;
  else
    select id, stage_order into v_neighbor_id, v_neighbor_order
    from public.process_stages
    where recruitment_process_id = v_process_id and stage_order > v_order
    order by stage_order asc
    limit 1;
  end if;

  -- Already first/last: nothing to do, and not an error (button should
  -- already be disabled, but a stale page or a double-click can race here).
  if v_neighbor_id is null then
    return;
  end if;

  update public.process_stages set stage_order = v_neighbor_order where id = p_stage_id;
  update public.process_stages set stage_order = v_order          where id = v_neighbor_id;
end;
$$;

-- No direct execute for anonymous/public API roles beyond `authenticated`;
-- RLS on the UPDATEs inside is_admin()-gates the real effect either way.
revoke all on function public.move_process_stage(uuid, text) from public, anon;
grant execute on function public.move_process_stage(uuid, text) to authenticated;
