import { createClient } from "@supabase/supabase-js";
import { judgeClient,verdict } from "./lib/judge0.mjs";
const provider=judgeClient();
if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Server Supabase key required");
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let stopping=false;process.on("SIGTERM",()=>{stopping=true;});process.on("SIGINT",()=>{stopping=true;});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw new Error(`Database ${error.code}`);return data;}
console.log("Coding worker started");
while(!stopping){
 let job;
 try{
  job=await rpc("claim_coding_job",{});
  if(!job){await delay(2000);continue;}
  let tokens=job.tokens;
  if(!tokens){tokens=await provider.create(job.payload);if(!await rpc("save_coding_tokens",{p_id:job.id,p_lease:job.lease,p_tokens:tokens}))continue;}
  const deadline=Date.now()+50000;
  while(!stopping && Date.now()<deadline){
   const results=await provider.results(tokens);
   if(results.every(r=>Number.isInteger(r.status?.id)&&r.status.id>2)){
    const result=verdict(results,job.payload.cases);
    await rpc("finish_coding_job",{p_id:job.id,p_lease:job.lease,p_status:result.status,p_passed:result.passed,p_feedback:result.feedback});
    break;
   }
   await delay(1500);
  }
  // Timed-out leases retry the SAME provider tokens; crashes do not lose ownership.
 }catch{
  // Do not log source, hidden cases, tokens or provider responses.
  console.error("Coding job temporarily failed",{id:job?.id??null});await delay(3000);
 }
}
console.log("Coding worker stopped");
