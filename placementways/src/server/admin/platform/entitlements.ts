"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { logAdminAction } from "@/server/admin/audit";
export async function grantEntitlement(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = { userId: field(form,"userId"), kind: field(form,"kind"), contentId: field(form,"contentId"), expiresAt: field(form,"expiresAt") };
  const parsed = z.object({ userId:z.uuid(), kind:z.enum(["course","test"]), contentId:z.uuid(), expiresAt:z.union([z.iso.datetime({offset:true}),z.literal("")]) }).safeParse(raw);
  if (!parsed.success) return { status:"error", values:raw, fieldErrors:z.flattenError(parsed.error).fieldErrors };
  const v=parsed.data;
  if (v.expiresAt && new Date(v.expiresAt).getTime() <= Date.now()) return {status:"error",values:raw,message:"Choose a future expiry."};
  const db=await createClient();
  const {data,error}=await db.from("content_entitlements").insert({user_id:v.userId,test_id:v.kind==="test"?v.contentId:null,course_id:v.kind==="course"?v.contentId:null,expires_at:v.expiresAt||null}).select("id").single();
  if (error || !data) return {status:"error",values:raw,message:"Could not grant access. Check the IDs or revoke the existing grant before replacing it."};
  await logAdminAction(db,admin.id,"entitlement.grant","content_entitlement",data.id);
  revalidatePath("/","layout");
  return {status:"success",message:"Access granted."};
}
export async function revokeEntitlement(id:string,_prev:FormState,_form:FormData):Promise<FormState> {
  const admin=await requireAdmin();
  if(!z.uuid().safeParse(id).success)return {status:"error",message:"Invalid grant."};
  const db=await createClient();
  const {data,error}=await db.from("content_entitlements").delete().eq("id",id).select("id").maybeSingle();
  if(error || !data)return {status:"error",message:"Could not revoke access."};
  await logAdminAction(db,admin.id,"entitlement.revoke","content_entitlement",id);
  revalidatePath("/","layout");
  return {status:"success",message:"Access revoked."};
}
