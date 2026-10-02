-- move_process_stage(): atomic swap used by the admin "reorder stages" UI.
begin;

insert into auth.users (id, email) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-reorder@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'student-reorder@example.com');
update public.profiles set role = 'admin' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Published (not draft): a student can SELECT this process's stages, so the
-- test below exercises the write-side RLS block, not read-side invisibility.
insert into public.recruitment_processes (id, company_id, title, status, last_verified_on)
select '90000000-0000-0000-0000-000000000001', id, 'Reorder fixture', 'published', '2026-01-01'
from public.companies where slug = 'tcs-nqt';
insert into public.process_sources (recruitment_process_id, label, url)
  values ('90000000-0000-0000-0000-000000000001', 'Official page', 'https://example.com/reorder-fixture');

insert into public.process_stages (id, recruitment_process_id, name, stage_order) values
  ('90000000-0000-0000-0000-0000000000a1', '90000000-0000-0000-0000-000000000001', 'Stage A', 1),
  ('90000000-0000-0000-0000-0000000000a2', '90000000-0000-0000-0000-000000000001', 'Stage B', 2),
  ('90000000-0000-0000-0000-0000000000a3', '90000000-0000-0000-0000-000000000001', 'Stage C', 3);

-- ---------- admin: move the middle stage up ---------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.move_process_stage('90000000-0000-0000-0000-0000000000a2', 'up');
  perform t.eq((select stage_order from public.process_stages where id = '90000000-0000-0000-0000-0000000000a1'), 2, 'A took B''s old slot');
  perform t.eq((select stage_order from public.process_stages where id = '90000000-0000-0000-0000-0000000000a2'), 1, 'B moved up to slot 1');
  perform t.eq((select stage_order from public.process_stages where id = '90000000-0000-0000-0000-0000000000a3'), 3, 'C untouched');
end $$;

-- Order is now B(1), A(2), C(3). Move the first stage up: no-op, no error.
do $$
begin
  perform public.move_process_stage('90000000-0000-0000-0000-0000000000a2', 'up');
  perform t.eq((select stage_order from public.process_stages where id = '90000000-0000-0000-0000-0000000000a2'), 1, 'already first: moving up is a no-op');
end $$;

-- Move the last stage down: also a no-op.
do $$
begin
  perform public.move_process_stage('90000000-0000-0000-0000-0000000000a3', 'down');
  perform t.eq((select stage_order from public.process_stages where id = '90000000-0000-0000-0000-0000000000a3'), 3, 'already last: moving down is a no-op');
end $$;

do $$
begin
  perform t.throws(
    $q$select public.move_process_stage('90000000-0000-0000-0000-0000000000a1', 'sideways')$q$,
    '22023', 'an invalid direction is rejected'
  );
end $$;
reset role;

-- ---------- student: RLS silently blocks the underlying UPDATEs -------
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  -- A student can still call the function (EXECUTE is granted to
  -- `authenticated`), but the UPDATEs inside affect zero rows because the
  -- admin-only RLS policy on process_stages filters them out. Order is
  -- unchanged -- exactly as if the request had been denied outright.
  perform public.move_process_stage('90000000-0000-0000-0000-0000000000a2', 'down');
  perform t.eq((select stage_order from public.process_stages where id = '90000000-0000-0000-0000-0000000000a2'), 1, 'a student cannot actually move a stage');
end $$;
reset role;

rollback;
