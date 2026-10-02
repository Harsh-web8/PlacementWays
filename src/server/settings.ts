import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";
export const publicSettings=cache(async()=>{
 if(!readSupabaseEnv().ok)return null;
 const {data}=await (await createClient()).from("site_settings").select("support_email,announcement").eq("id",true).maybeSingle();return data;
});
