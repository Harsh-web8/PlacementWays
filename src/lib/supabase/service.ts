import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";
/** Server only. Call exclusively after validating identity/signature and concrete operation. */
export function serviceClient(){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error("Server database configuration missing");
 return createClient<Database>(requireSupabaseEnv().url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
