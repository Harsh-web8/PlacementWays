/** M05 read-only editorial coverage report. Run server-side with Supabase service credentials. */
import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.');process.exit(1);}
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function all(table,columns,filter){
 let output=[];for(let start=0;start<50000;start+=1000){
  let q=db.from(table).select(columns).range(start,start+999);
  if(filter)q=q.eq(...filter);
  const {data,error}=await q;
  if(error)throw new Error(`${table} unavailable: ${error.code}`);
  output=output.concat(data??[]);if(!data||data.length<1000)break;
 }return output;
}
try{
 const [companies,roles,drives,rounds,sources]=await Promise.all([
  all('companies','id,name,slug,status',['status','published']),
  all('company_roles','id,company_id,title,status,source_url,last_verified_at',['status','published']),
  all('recruitment_drives','id,role_id,title,status,source_url,last_verified_at',['status','published']),
  all('recruitment_rounds','id,drive_id,source_url,source_kind'),
  all('recruitment_watch_sources','id,company_id,enabled,last_checked_at,last_success_at,last_error'),
 ]);
 const publishedRoleIds=new Set(roles.map(r=>r.id));
 const publishedDrives=drives.filter(d=>publishedRoleIds.has(d.role_id));
 const companiesWithWatch=new Set(sources.filter(s=>s.enabled).map(s=>s.company_id));
 const now=Date.now(),stale=7*86400000;
 const missingSources=companies.filter(c=>!companiesWithWatch.has(c.id)).map(c=>({company:c.name,slug:c.slug}));
 const missingRoles=companies.filter(c=>!roles.some(r=>r.company_id===c.id)).map(c=>c.slug);
 const missingDrives=roles.filter(r=>!publishedDrives.some(d=>d.role_id===r.id)).map(r=>r.id);
 const missingRounds=publishedDrives.filter(d=>!rounds.some(r=>r.drive_id===d.id)).map(d=>d.id);
 const unverifiedRoles=roles.filter(r=>!r.source_url||!r.last_verified_at||now-Date.parse(r.last_verified_at)>stale).map(r=>r.id);
 const unhealthySources=sources.filter(s=>s.enabled&&(!s.last_success_at||now-Date.parse(s.last_success_at)>stale||s.last_error)).map(s=>s.id);
 console.log(JSON.stringify({generated_at:new Date().toISOString(),summary:{published_companies:companies.length,published_roles:roles.length,published_drives:publishedDrives.length,selection_rounds:rounds.length,enabled_sources:sources.filter(s=>s.enabled).length},gaps:{companies_without_enabled_watch:missingSources,companies_without_published_roles:missingRoles,roles_without_published_drive:missingDrives,drives_without_rounds:missingRounds,roles_unverified_7d:unverifiedRoles,enabled_sources_unhealthy_or_stale:unhealthySources}},null,2));
}catch(e){console.error('Coverage report failed:',e instanceof Error?e.message:'Unknown failure');process.exitCode=1;}
