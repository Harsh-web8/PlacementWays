import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";
export const dynamic="force-dynamic";
export async function GET(){
 const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex"};const env=readSupabaseEnv();
 if(!env.ok)return Response.json({status:"unavailable"},{status:503,headers});
 try{
  const db=createClient<Database>(env.url,env.anonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(5000)})}});
  const {data,error}=await db.from("site_settings").select("coding_enabled,commerce_enabled").eq("id",true).single();
  if(error||!data)throw new Error();return Response.json({status:"ok"},{headers});
 }catch{return Response.json({status:"unavailable"},{status:503,headers});}
}
