-- M07: executable on the *throwaway* PostgreSQL test database only.
-- Covers approved structured changes, student/guest denial, rollback and
-- optimistic-concurrency failure with no partial public publication.
begin;

insert into auth.users(id,email) values
 ('73100000-0000-0000-0000-000000000001','recruitment-admin-fixture@example.test'),
 ('73100000-0000-0000-0000-000000000002','recruitment-student-fixture@example.test');
update public.profiles set role='admin'
 where id='73100000-0000-0000-0000-000000000001';

insert into public.company_roles (id,company_id,slug,title,status)
select '73100000-0000-0000-0000-000000000003',id,'test-m07-role','M07 Test Role','published'
from public.companies where slug='infosys';
insert into public.recruitment_drives (id,role_id,title,status,drive_status)
values ('73100000-0000-0000-0000-000000000004',
 '73100000-0000-0000-0000-000000000003','M07 Synthetic Hiring Drive','published','upcoming');
insert into public.recruitment_rounds(id,drive_id,round_number,name,round_type)
values ('73100000-0000-0000-0000-000000000005',
 '73100000-0000-0000-0000-000000000004',1,'Synthetic Assessment','assessment');
insert into public.recruitment_watch_sources(id,company_id,role_id,drive_id,label,source_url)
select '73100000-0000-0000-0000-000000000006',id,
 '73100000-0000-0000-0000-000000000003',
 '73100000-0000-0000-0000-000000000004',
 'M07 synthetic source','https://recruitment-fixture.example.test/m07'
from public.companies where slug='infosys';

insert into public.recruitment_change_proposals
 (id,watch_source_id,company_id,role_id,drive_id,fingerprint,headline,summary,evidence,
  observed_excerpt,source_url,extraction_status)
select '73100000-0000-0000-0000-000000000007',
 '73100000-0000-0000-0000-000000000006',id,
 '73100000-0000-0000-0000-000000000003',
 '73100000-0000-0000-0000-000000000004',repeat('7',64),
 'Synthetic test round details','M07 database acceptance fixture — not a recruitment announcement',
 'Synthetic assessment lasts 60 minutes.',
 'Synthetic assessment lasts 60 minutes. Only synthetic degree eligibility applies.',
 'https://recruitment-fixture.example.test/m07','suggested'
from public.companies where slug='infosys';

insert into public.recruitment_field_changes
 (proposal_id,target_kind,target_id,field_key,old_value,new_value,evidence_quote)
values
 ('73100000-0000-0000-0000-000000000007','role',
  '73100000-0000-0000-0000-000000000003','eligibility',null,
  to_jsonb('Only synthetic degree eligibility applies.'::text),
  'Only synthetic degree eligibility applies.'),
 ('73100000-0000-0000-0000-000000000007','round',
  '73100000-0000-0000-0000-000000000005','duration_minutes',null,
  '60'::jsonb,'Synthetic assessment lasts 60 minutes.');

set local role anon;
select t.throws($q$select public.approve_recruitment_proposal('73100000-0000-0000-0000-000000000007',true)$q$,
 '42501','anonymous visitor cannot approve structured edits');
reset role;

select set_config('request.jwt.claims',
 '{"sub":"73100000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select t.throws($q$select public.approve_recruitment_proposal('73100000-0000-0000-0000-000000000007',true)$q$,
 '42501','student cannot approve structured edits');
reset role;

select set_config('request.jwt.claims',
 '{"sub":"73100000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select t.eq(public.approve_recruitment_proposal('73100000-0000-0000-0000-000000000007',true),
 'approved'::text,'admin approves all documented fields atomically');
select t.eq((select eligibility from public.company_roles where id='73100000-0000-0000-0000-000000000003'),
 'Only synthetic degree eligibility applies.'::text,'role eligibility updated');
select t.eq((select duration_minutes from public.recruitment_rounds where id='73100000-0000-0000-0000-000000000005'),
 60::integer,'round duration updated');
select t.eq((select structured_change_count from public.recruitment_updates
 where proposal_id='73100000-0000-0000-0000-000000000007'),2::integer,
 'publication includes exact structured-change count');
select t.eq(public.approve_recruitment_proposal('73100000-0000-0000-0000-000000000007',true),
 'approved'::text,'repeat approval is idempotent');
select t.eq(public.rollback_recruitment_proposal('73100000-0000-0000-0000-000000000007'),
 'rolled_back'::text,'approved updates can be rolled back');
select t.eq((select eligibility from public.company_roles where id='73100000-0000-0000-0000-000000000003'),
 null::text,'rollback restores role field');
select t.eq((select duration_minutes from public.recruitment_rounds where id='73100000-0000-0000-0000-000000000005'),
 null::integer,'rollback restores round field');
select t.eq((select count(*)::integer from public.recruitment_updates
 where proposal_id='73100000-0000-0000-0000-000000000007' and is_current),0,
 'rolled-back public announcement is retracted');
reset role;

-- Stale expected-old value must reject whole transaction and publish nothing.
insert into public.recruitment_change_proposals
 (id,watch_source_id,company_id,role_id,drive_id,fingerprint,headline,summary,evidence,
  observed_excerpt,source_url)
select '73100000-0000-0000-0000-000000000008',
 '73100000-0000-0000-0000-000000000006',id,
 '73100000-0000-0000-0000-000000000003',
 '73100000-0000-0000-0000-000000000004',repeat('8',64),
 'Stale test proposal','Synthetic stale-value fixture','Synthetic new eligibility.',
 'Synthetic new eligibility. Assessment lasts 45 minutes.',
 'https://recruitment-fixture.example.test/m07'
from public.companies where slug='infosys';
insert into public.recruitment_field_changes
 (proposal_id,target_kind,target_id,field_key,old_value,new_value,evidence_quote)
values
 ('73100000-0000-0000-0000-000000000008','round',
  '73100000-0000-0000-0000-000000000005','duration_minutes',null,
  '45'::jsonb,'Assessment lasts 45 minutes.'),
 ('73100000-0000-0000-0000-000000000008','role',
  '73100000-0000-0000-0000-000000000003','eligibility',null,
  to_jsonb('Synthetic new eligibility.'::text),'Synthetic new eligibility.');
update public.company_roles set eligibility='Manual admin edit'
 where id='73100000-0000-0000-0000-000000000003';
select set_config('request.jwt.claims',
 '{"sub":"73100000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select t.throws($q$select public.approve_recruitment_proposal('73100000-0000-0000-0000-000000000008',true)$q$,
 '40001','stale source proposal cannot overwrite a manual edit');
select t.eq((select status from public.recruitment_change_proposals
 where id='73100000-0000-0000-0000-000000000008'),
 'pending'::text,'failed multi-field approval remains pending');
select t.eq((select duration_minutes from public.recruitment_rounds
 where id='73100000-0000-0000-0000-000000000005'),null::integer,
 'stale multi-field approval leaves assessment unchanged');
select t.eq((select count(*)::integer from public.recruitment_updates
 where proposal_id='73100000-0000-0000-0000-000000000008'),0,
 'stale proposal cannot appear in public recruitment feed');
reset role;
rollback;
