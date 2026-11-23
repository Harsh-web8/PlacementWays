import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessStagingConfiguration} from '../../scripts/lib/staging-config-core.mjs';
const fixture={
 DEPLOYMENT_ENV:'staging',STAGING_DB_ISOLATED:'true',
 STAGING_BASE_URL:'https://staging.placementways.example/',
 NEXT_PUBLIC_SITE_URL:'https://staging.placementways.example/',
 NEXT_PUBLIC_SUPABASE_URL:'https://staging-db.supabase.example/',
 NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_fake_fixture',
 SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fake_fixture',
 PLACEMENTWAYS_ENABLE_COMMERCE:'false',STRIPE_LIVE_MODE:'false',
 RECRUITMENT_CRON_SECRET:'s'.repeat(40),
 RECRUITMENT_ALLOWED_HOSTS:'careers.example.org',
 GUEST_RATE_LIMIT_SECRET:'g'.repeat(40),GUEST_TRUSTED_IP_HEADER:'x-verified-visitor',
 OPENAI_API_KEY:'fake-fixture',JUDGE0_URL:'https://isolated-coder.example/',
};
test('isolated HTTPS staging configuration can pass offline checks',()=>{
 assert.deepEqual(assessStagingConfiguration(fixture,{nodeMajor:24,requireAi:true,requireCoding:true}),{blockers:[],warnings:[]});
});
test('production environment or unconfirmed DB isolation is blocked',()=>{
 const result=assessStagingConfiguration({...fixture,DEPLOYMENT_ENV:'production',STAGING_DB_ISOLATED:''},{nodeMajor:24});
 assert.equal(result.blockers.length,2);
});
test('payment enabling and public service-role key are blocked',()=>{
 const result=assessStagingConfiguration({...fixture,PLACEMENTWAYS_ENABLE_COMMERCE:'true',SUPABASE_SERVICE_ROLE_KEY:fixture.NEXT_PUBLIC_SUPABASE_ANON_KEY},{nodeMajor:24});
 assert.ok(result.blockers.some(v=>v.includes('free')));
 assert.ok(result.blockers.some(v=>v.includes('public Supabase')));
});
test('source allowlist and secret entropy requirements are checked',()=>{
 const result=assessStagingConfiguration({...fixture,RECRUITMENT_CRON_SECRET:'x',RECRUITMENT_ALLOWED_HOSTS:''},{nodeMajor:24});
 assert.ok(result.blockers.some(v=>v.includes('32+')));
 assert.ok(result.blockers.some(v=>v.includes('Allowlist')));
});
test('optional AI and coding providers produce explicit warnings',()=>{
 const result=assessStagingConfiguration({...fixture,OPENAI_API_KEY:'',JUDGE0_URL:''},{nodeMajor:24});
 assert.equal(result.blockers.length,0);
 assert.equal(result.warnings.length,2);
 const strict=assessStagingConfiguration({...fixture,OPENAI_API_KEY:'',JUDGE0_URL:''},{nodeMajor:24,requireAi:true,requireCoding:true});
 assert.equal(strict.blockers.length,2);
});
test('guest mock rate limiting is required even with coding disabled',()=>{
 const result=assessStagingConfiguration({...fixture,GUEST_RATE_LIMIT_SECRET:'',GUEST_TRUSTED_IP_HEADER:''},{nodeMajor:24});
 assert.equal(result.blockers.length,2);
 assert.ok(result.blockers.some(message=>message.includes('anonymous mocks')));
 assert.ok(result.blockers.some(message=>message.includes('ingress')));
});
test('protected Vercel Preview requires a matching Supabase ref and the Vercel ingress header',()=>{
 const ref='abcdefghijklmnopqrst';
 const input={...fixture,STAGING_SUPABASE_PROJECT_REF:ref,NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,
   GUEST_TRUSTED_IP_HEADER:'x-vercel-forwarded-for',VERCEL_AUTOMATION_BYPASS_SECRET:'synthetic-bypass'};
 assert.deepEqual(assessStagingConfiguration(input,{nodeMajor:24,vercelPreview:true}),{blockers:[],warnings:[]});
 const invalid={...input,NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co',GUEST_TRUSTED_IP_HEADER:'x-client-ip',VERCEL_AUTOMATION_BYPASS_SECRET:''};
 assert.equal(assessStagingConfiguration(invalid,{nodeMajor:24,vercelPreview:true}).blockers.length,3);
});
test('staging origin and site origin must match',()=>{
 const result=assessStagingConfiguration({...fixture,NEXT_PUBLIC_SITE_URL:'https://www.placementways.example/'},{nodeMajor:24});
 assert.ok(result.blockers.some(v=>v.includes('same staging origin')));
});
