"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser,requireAdmin } from "@/server/auth/session";
import { field,type FormState } from "@/lib/form-state";
import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/server/admin/audit";
export async function executeCode(questionId:string,_prev:FormState,form:FormData):Promise<FormState>{
 await requireUser();
 const parsed=z.object({id:z.uuid(),source:z.string().min(1).max(20000).refine(s=>Buffer.byteLength(s)<=20000),language:z.string().regex(/^[a-z][a-z0-9_]{0,29}$/),kind:z.enum(["run","submit"])}).safeParse({id:questionId,source:field(form,"source"),language:field(form,"language"),kind:field(form,"kind")});
 if(!parsed.success)return {status:"error",message:"Choose a language and enter code (maximum 20 KB)."};
 const db=await createClient();const {data,error}=await db.rpc("start_coding_submission",{p_question_id:parsed.data.id,p_source:parsed.data.source,p_language:parsed.data.language,p_kind:parsed.data.kind});
 if(error||!data)return {status:"error",message:error?.code==="23514"?error.message:"Could not start execution. Please try again."};
 redirect(`/coding/submissions/${data}`);
}
export async function saveTestCase(questionId:string,id:string|null,_prev:FormState,form:FormData):Promise<FormState>{
 const admin=await requireAdmin();
 const raw={input:field(form,"input"),expected_output:field(form,"expected_output"),position:field(form,"position"),is_sample:field(form,"is_sample")};
 const parsed=z.object({input:z.string().max(16000),expected_output:z.string().max(16000),position:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(20)),is_sample:z.enum(["true","false"]).transform(v=>v==="true")}).safeParse(raw);
 if(!z.uuid().safeParse(questionId).success||(id&&!z.uuid().safeParse(id).success)||!parsed.success)return {status:"error",values:raw,message:"Use valid test data and a unique position from 1 to 20."};
 const db=await createClient();const values={...parsed.data,question_id:questionId};
 const result=id?await db.from("coding_test_cases").update(values).eq("id",id).eq("question_id",questionId).select("id").maybeSingle():await db.from("coding_test_cases").insert(values).select("id").single();
 if(result.error||!result.data)return {status:"error",values:raw,message:"Could not save. Positions must be unique; input/output must be at most 16 KB each."};
 await logAdminAction(db,admin.id,"coding.case.save","coding_test_case",result.data.id);
 revalidatePath("/","layout");return {status:"success",message:"Test case saved.",values:raw};
}
export async function deleteTestCase(id:string,_prev:FormState,_form:FormData):Promise<FormState>{
 const admin=await requireAdmin();if(!z.uuid().safeParse(id).success)return {status:"error",message:"Invalid case."};
 const db=await createClient();const {data,error}=await db.from("coding_test_cases").delete().eq("id",id).select("id").maybeSingle();
 if(error||!data)return {status:"error",message:"Could not delete case."};
 await logAdminAction(db,admin.id,"coding.case.delete","coding_test_case",id);revalidatePath("/","layout");return {status:"success",message:"Test case deleted. Existing executions keep their original cases."};
}
export async function saveCodingSettings(_prev:FormState,form:FormData):Promise<FormState>{
 const admin=await requireAdmin();const raw={coding_enabled:field(form,"coding_enabled"),coding_hourly_limit:field(form,"coding_hourly_limit"),coding_daily_limit:field(form,"coding_daily_limit")};
 const parsed=z.object({coding_enabled:z.enum(["true","false"]).transform(v=>v==="true"),coding_hourly_limit:z.coerce.number().int().min(1).max(200),coding_daily_limit:z.coerce.number().int().min(1).max(1000)}).safeParse(raw);
 if(!parsed.success)return {status:"error",values:raw,message:"Choose valid execution limits."};
 const db=await createClient();const {error}=await db.from("site_settings").update(parsed.data).eq("id",true);
 if(error)return {status:"error",message:"Could not save settings."};
 await logAdminAction(db,admin.id,"coding.settings","site_settings","true");revalidatePath("/","layout");return {status:"success",message:"Coding settings saved.",values:raw};
}
export async function saveLanguage(key:string,_prev:FormState,form:FormData):Promise<FormState>{
 const admin=await requireAdmin();const raw={name:field(form,"name"),provider_id:field(form,"provider_id"),enabled:field(form,"enabled")};
 const parsed=z.object({name:z.string().trim().min(1).max(100),provider_id:z.coerce.number().int().min(1).max(100000),enabled:z.enum(["true","false"]).transform(v=>v==="true")}).safeParse(raw);
 if(!parsed.success||!/^[a-z][a-z0-9_]{0,29}$/.test(key))return {status:"error",message:"Invalid language settings."};
 const db=await createClient();const {data,error}=await db.from("coding_languages").update(parsed.data).eq("key",key).select("key").maybeSingle();
 if(error||!data)return {status:"error",message:"Could not save language."};
 await logAdminAction(db,admin.id,"coding.language","coding_language",key);revalidatePath("/","layout");return {status:"success",message:"Language saved.",values:raw};
}
