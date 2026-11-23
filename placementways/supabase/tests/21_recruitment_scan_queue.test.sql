begin;
insert into auth.users(id,email) values
 ('81000000-0000-4000-8000-000000000001','queue-admin@example.test');
update public.profiles set role='admin' where id='81000000-0000-4000-8000-000000000001';
insert into public.company_roles(id,company_id,slug,title,status,eligibility)
select '81000000-0000-4000-8000-000000000002',id,'queue-fixture','Synthetic fixture role','published','Eligibility before review'
from public.companies where slug='infosys';
insert into public.recruitment_watch_sources(id,company_id,role_id,label,source_url)
select '81000000-0000-4000-8000-000000000003',company_id,id,'Synthetic fixture source','https://fixture.example.test/notice'
from public.company_roles where slug='queue-fixture';

select set_config('t.queue_source','81000000-0000-4000-8000-000000000003',true);
select set_config('t.queue_patch','[{"target_kind":"role","target_id":"81000000-0000-4000-8000-000000000002","field_key":"eligibility","old_value":"Eligibility before review","new_value":"Revised fixture eligibility","evidence_quote":"Revised fixture eligibility"}]',true);
select set_config('t.queue_item','{"headline":"Reviewed fixture draft","summary":"Synthetic eligibility notice","evidence":"Revised fixture eligibility","classification":"eligibility"}',true);

set local role anon;
select t.throws($q$select public.queue_recruitment_scan(null,null,null,null,null,null,null,false)$q$,
 '42501','anonymous callers cannot enter the editorial queue');
reset role;

-- Fail closed when the new-project service account has no inherited public-table grants.
revoke all on public.recruitment_change_proposals from service_role;
grant select (watch_source_id,fingerprint,previous_excerpt) on public.recruitment_change_proposals to service_role;
set local role service_role;
select t.eq(public.queue_recruitment_scan(current_setting('t.queue_source')::uuid,repeat('a',64),
 'Revised fixture eligibility','Eligibility before review',
 '{"headline":"Source changed","summary":"Review needed","evidence":"Revised fixture eligibility","classification":"source_change"}',
 '[]','[]',false),true,'outage fallback is queued privately');
select t.eq((select previous_excerpt from public.recruitment_change_proposals
 where watch_source_id=current_setting('t.queue_source')::uuid and fingerprint=repeat('a',64)),
 'Eligibility before review'::text,'worker can recover the previous snapshot with explicit grants');
select t.eq(public.queue_recruitment_scan(current_setting('t.queue_source')::uuid,repeat('a',64),
 'Revised fixture eligibility','Eligibility before review',current_setting('t.queue_item')::jsonb,
 current_setting('t.queue_patch')::jsonb,'[]',true),true,'AI retry enriches the same proposal atomically');
reset role;

select t.eq((select count(*) from public.recruitment_change_proposals where fingerprint=repeat('a',64)),
 1::bigint,'unchanged fingerprint keeps one proposal');
select set_config('t.queue_proposal',(select id::text from public.recruitment_change_proposals
 where watch_source_id=current_setting('t.queue_source')::uuid and fingerprint=repeat('a',64)),true);

set local role anon;
select t.eq((select eligibility from public.company_roles where slug='queue-fixture'),
 'Eligibility before review'::text,'public role does not change before approval');
select t.eq((select count(*) from public.recruitment_updates where proposal_id=current_setting('t.queue_proposal')::uuid),
 0::bigint,'pending extraction never enters the public feed');
reset role;

select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select t.eq(public.approve_recruitment_proposal(current_setting('t.queue_proposal')::uuid,true),
 'approved'::text,'admin approval publishes the complete retry');
reset role;
select set_config('request.jwt.claim.sub','',true);

set local role service_role;
select t.eq(public.queue_recruitment_scan(current_setting('t.queue_source')::uuid,repeat('a',64),
 'Late fixture data','Revised fixture eligibility',current_setting('t.queue_item')::jsonb,
 current_setting('t.queue_patch')::jsonb,'[]',true),false,'late extraction cannot modify an approved proposal');
reset role;
set local role anon;
select t.eq((select eligibility from public.company_roles where slug='queue-fixture'),
 'Revised fixture eligibility'::text,'approved fields become public');
select t.eq((select headline from public.recruitment_updates where proposal_id=current_setting('t.queue_proposal')::uuid),
 'Reviewed fixture draft'::text,'approved feed uses the enriched draft');
reset role;
rollback;
