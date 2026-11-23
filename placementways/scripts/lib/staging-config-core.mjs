import { stagingDatabaseRef } from "./staging-migrations.mjs";

/** Offline staging readiness rules; NEVER prints or returns any credential values. */
const looksLikeHttpsOrigin=(raw)=>{
  try{
    const url=new URL(raw);
    return url.protocol==='https:' && !url.username && !url.password && !url.search &&
      !url.hash && url.pathname==='/' && !['localhost','127.0.0.1'].includes(url.hostname);
  }catch{return false;}
};

export function assessStagingConfiguration(env,{nodeMajor=Number(process.versions.node.split('.')[0]),requireAi=false,requireCoding=false,vercelPreview=false}={}){
  const blockers=[],warnings=[];
  if(nodeMajor!==24)blockers.push('Use Node.js 24 for staging and release validation.');
  if(env.DEPLOYMENT_ENV!=='staging')blockers.push('DEPLOYMENT_ENV must equal staging.');
  if(env.STAGING_DB_ISOLATED!=='true')blockers.push('Confirm a SEPARATE staging database: STAGING_DB_ISOLATED=true. Verify manually.');
  for(const key of ['STAGING_BASE_URL','NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_SUPABASE_URL']){
    if(!looksLikeHttpsOrigin(env[key]))blockers.push(`${key} must be an HTTPS origin.`);
  }
  if(looksLikeHttpsOrigin(env.STAGING_BASE_URL) && looksLikeHttpsOrigin(env.NEXT_PUBLIC_SITE_URL) &&
      new URL(env.STAGING_BASE_URL).origin!==new URL(env.NEXT_PUBLIC_SITE_URL).origin){
    blockers.push('STAGING_BASE_URL and NEXT_PUBLIC_SITE_URL must refer to the same staging origin.');
  }
  for(const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']){
    if(!env[key])blockers.push(`${key} is missing.`);
  }
  if(env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY===env.SUPABASE_SERVICE_ROLE_KEY){
    blockers.push('Never use the server service-role key as the public Supabase key.');
  }
  if(env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_publishable_')){
    blockers.push('Server service-role credential must not be a publishable key.');
  }
  if(env.PLACEMENTWAYS_ENABLE_COMMERCE==='true'||env.STRIPE_LIVE_MODE==='true'){
    blockers.push('V1 is free: payments must remain disabled in staging.');
  }
  if(env.ALLOW_LOCAL_SERVICES==='true')blockers.push('Disable local service overrides on public staging.');
  if((env.RECRUITMENT_CRON_SECRET??'').length<32)blockers.push('Set a 32+ character RECRUITMENT_CRON_SECRET.');
  if(!(env.RECRUITMENT_ALLOWED_HOSTS??'').split(',').some(s=>s.trim())){
    blockers.push('Allowlist at least one authorized recruitment source hostname.');
  }
  if((env.GUEST_RATE_LIMIT_SECRET??'').length<32)blockers.push('Set GUEST_RATE_LIMIT_SECRET (32+ chars) for anonymous mocks, answers and coding.');
  if(!env.GUEST_TRUSTED_IP_HEADER)blockers.push('Configure a trusted ingress IP header for anonymous submissions.');
  if(!env.JUDGE0_URL?.startsWith('https://')){
    (requireCoding?blockers:warnings).push('Configure a dedicated HTTPS Judge0-compatible isolated executor and worker for coding.');
  }
  if(!env.OPENAI_API_KEY){
    (requireAi?blockers:warnings).push('Configure OPENAI_API_KEY for structured AI extraction; without it changes require manual review.');
  }
  if(vercelPreview){
    if(env.GUEST_TRUSTED_IP_HEADER?.toLowerCase()!=='x-vercel-forwarded-for'){
      blockers.push('Use GUEST_TRUSTED_IP_HEADER=x-vercel-forwarded-for for direct Vercel ingress.');
    }
    if(!env.VERCEL_AUTOMATION_BYPASS_SECRET){
      blockers.push('Set the Vercel automation bypass secret in the QA runner.');
    }
    try{stagingDatabaseRef(env);}catch(error){blockers.push(error.message);}
  }
  return {blockers,warnings};
}
