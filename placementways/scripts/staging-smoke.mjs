import {runStagingSmoke} from './lib/staging-smoke-core.mjs';
import {stagingFetch,stagingOrigin} from './lib/staging-target.mjs';

const raw=process.env.STAGING_BASE_URL;
if(!raw){console.error('Set STAGING_BASE_URL to your deployed staging origin (HTTPS).');process.exit(2);}
let base,fetchImpl;
try{
  base=stagingOrigin(raw,{allowLoopback:process.env.ALLOW_LOCAL_SMOKE==='true'});
  fetchImpl=stagingFetch(base,process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
}catch(error){console.error(error.message);process.exit(2);}
const results=await runStagingSmoke(base,{fetchImpl});
for(const item of results)console.log(`${item.pass?'PASS':'FAIL'}  ${item.name}: ${item.note}`);
const failed=results.filter(r=>!r.pass);
console.log(`Staging checks: ${results.length-failed.length}/${results.length} passed`);
if(failed.length)process.exitCode=1;
