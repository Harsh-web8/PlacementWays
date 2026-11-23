-- Milestone 4 integration tests. Executed by supabase/tests/run.sh against a throw-away PostgreSQL database.
-- This suite is NEVER run against a production Supabase database.
begin;

insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','discovery-admin@example.test'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','discovery-student@example.test');
update public.profiles set role='admin' where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.recruitment_watch_sources(id,company_id,label,source_url)
select 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',id,'Official test source','https://example.org/campus'
from public.companies where slug='infosys';

insert into public.recruitment_change_proposals
 (id,watch_source_id,company_id,fingerprint,headline,summary,evidence,observed_excerpt,source_url)
select 'ffffffff-ffff-ffff-ffff-ffffffffffff','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',id,
 repeat('a',64),'Test engineering drive','Official test announcement',
 'Official recruitment of PlacementWays Test Engineer for 2028 Campus Hiring.',
 'Official recruitment of PlacementWays Test Engineer for 2028 Campus Hiring.',
 'https://example.org/campus'
from public.companies where slug='infosys';

insert into public.recruitment_discovery_candidates
 (id,proposal_id,company_id,kind,role_title,payload,evidence_quote,dedupe_key)
select 'dddddddd-dddd-dddd-dddd-dddddddddddd','ffffffff-ffff-ffff-ffff-ffffffffffff',id,
 'role','PlacementWays Test Engineer',
 '{"role":{"title":"PlacementWays Test Engineer","description":"Quality assurance role"},"drive":{"title":"2028 Campus Hiring","hiring_year":2028}}'::jsonb,
 'Official recruitment of PlacementWays Test Engineer for 2028 Campus Hiring.', repeat('b',64)
from public.companies where slug='infosys';

-- The source monitor can claim due URLs only once while its lease is active.
set local role service_role;
select t.eq((select count(*)::integer from public.claim_recruitment_watch_sources(1)),1,'first service claim gets due source');
select t.eq((select count(*)::integer from public.claim_recruitment_watch_sources(1)),0,'second service claim does not duplicate leased source');
reset role;

set local role anon;
select t.throws($q$select count(*) from public.recruitment_discovery_candidates$q$,'42501','anonymous cannot read private discoveries');
select t.throws($q$select public.decide_recruitment_discovery('dddddddd-dddd-dddd-dddd-dddddddddddd',true)$q$,'42501','anonymous cannot approve discoveries');
reset role;

select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}',true);
set local role authenticated;
select t.eq((select count(*)::integer from public.recruitment_discovery_candidates),0,'non-admin sees no discoveries');
select t.throws($q$select public.decide_recruitment_discovery('dddddddd-dddd-dddd-dddd-dddddddddddd',true)$q$,'42501','non-admin cannot approve');
reset role;

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
set local role authenticated;
select t.eq(public.decide_recruitment_discovery('dddddddd-dddd-dddd-dddd-dddddddddddd',true),'approved'::text,'admin approves new role + drive atomically');
select t.eq((select count(*)::integer from public.company_roles where title='PlacementWays Test Engineer'),1,'new role was published');
select t.eq((select count(*)::integer from public.recruitment_drives where title='2028 Campus Hiring'),1,'new drive was published');
select t.eq(public.decide_recruitment_discovery('dddddddd-dddd-dddd-dddd-dddddddddddd',true),'approved'::text,'repeat approval is idempotent');
select t.eq(public.rollback_recruitment_discovery('dddddddd-dddd-dddd-dddd-dddddddddddd'),'rolled_back'::text,'rollback removes unmodified new guides');
select t.eq((select count(*)::integer from public.company_roles where title='PlacementWays Test Engineer'),0,'rollback removed role');
select t.eq((select count(*)::integer from public.recruitment_drives where title='2028 Campus Hiring'),0,'rollback removed drive');
reset role;
rollback;
