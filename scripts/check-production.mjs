// Run in the deployment environment. Outputs variable names/status only, never secrets.
import { createClient } from "@supabase/supabase-js";
const problems=[];const env=process.env;
for(const key of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","NEXT_PUBLIC_SITE_URL","GUEST_RATE_LIMIT_SECRET","GUEST_TRUSTED_IP_HEADER"]){if(!env[key])problems.push(`${key} is missing`);}
for(const key of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SITE_URL"]){try{const url=new URL(env[key]);if(url.protocol!=="https:"||["localhost","127.0.0.1"].includes(url.hostname)||url.username||url.password||url.search||url.hash)throw new Error();}catch{problems.push(`${key} must be a production HTTPS origin`);}}
if(env.ALLOW_LOCAL_SERVICES==="true")problems.push("ALLOW_LOCAL_SERVICES must be disabled");
if(env.DEPLOYMENT_ENV!=="production")problems.push("DEPLOYMENT_ENV must be production");
if((env.GUEST_RATE_LIMIT_SECRET??"").length<32)problems.push("GUEST_RATE_LIMIT_SECRET must have at least 32 characters");
if(env.SUPABASE_SERVICE_ROLE_KEY===env.NEXT_PUBLIC_SUPABASE_ANON_KEY||env.SUPABASE_SERVICE_ROLE_KEY?.startsWith("sb_publishable_"))problems.push("Server Supabase key cannot be the public key");
if(!problems.length){
 try{
  const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}});
  const {data,error}=await db.from("site_settings").select("coding_enabled,commerce_enabled,support_email").eq("id",true).single();if(error||!data)throw new Error();
  if(!data.support_email)problems.push("Configure the support email in Admin settings");
  if(data.coding_enabled){if(!env.JUDGE0_URL?.startsWith("https://"))problems.push("Configure a dedicated HTTPS JUDGE0_URL");const heartbeat=await db.from("worker_heartbeats").select("last_seen").eq("name","coding").maybeSingle();if(heartbeat.error||!heartbeat.data||Date.now()-Date.parse(heartbeat.data.last_seen)>120000)problems.push("Coding worker heartbeat is stale/missing");}
  if(data.commerce_enabled){if(!env.STRIPE_SECRET_KEY?.startsWith("sk_live_")||!env.STRIPE_WEBHOOK_SECRET||env.STRIPE_LIVE_MODE!=="true")problems.push("Live commerce configuration is incomplete");if(env.STRIPE_API_BASE&&env.STRIPE_API_BASE!=="https://api.stripe.com")problems.push("Remove the payment emulator endpoint");}
 }catch{problems.push("Target database is unreachable or migrations are incomplete");}
}
for(const problem of problems)console.error(`BLOCKED: ${problem}`);
if(problems.length)process.exitCode=1;else console.log("Configuration/database checks passed. Complete the production release checklist before launch.");
