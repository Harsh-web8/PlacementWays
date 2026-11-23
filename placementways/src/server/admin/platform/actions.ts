"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireAdmin} from "@/server/auth/session";
import {createClient} from "@/lib/supabase/server";
import {field,type FormState} from "@/lib/form-state";
import {logAdminAction} from "@/server/admin/audit";
const postSchema=z.object({title:z.string().trim().min(1).max(200),slug:z.string().max(150).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),description:z.string().max(500),body:z.string().min(1).max(100000),status:z.enum(["draft","published","archived"])});
export async function savePost(id:string|null,_prev:FormState,form:FormData):Promise<FormState> {
  const admin=await requireAdmin();
  if(id && !z.uuid().safeParse(id).success)return {status:"error",message:"Invalid post."};
  const raw=Object.fromEntries(Object.keys(postSchema.shape).map(k=>[k,field(form,k)]));const parsed=postSchema.safeParse(raw);
  if(!parsed.success)return {status:"error",values:raw,fieldErrors:z.flattenError(parsed.error).fieldErrors};
  const db=await createClient();const result=id?await db.from("blog_posts").update(parsed.data).eq("id",id).select("id").maybeSingle():await db.from("blog_posts").insert(parsed.data).select("id").single();
  if(result.error || !result.data)return {status:"error",values:raw,message:"Could not save. Check that the slug is unique."};
  await logAdminAction(db,admin.id,"blog.save","blog_post",result.data.id);revalidatePath("/","layout");
  if(!id)redirect(`/admin/blog/${result.data.id}`);return {status:"success",message:"Post saved.",values:raw};
}
export async function deletePost(id:string,_prev:FormState,_form:FormData):Promise<FormState> {
  const admin=await requireAdmin();if(!z.uuid().safeParse(id).success)return {status:"error",message:"Invalid post."};
  const db=await createClient();const {data,error}=await db.from("blog_posts").delete().eq("id",id).select("id").maybeSingle();
  if(error||!data)return {status:"error",message:"Could not delete post."};
  await logAdminAction(db,admin.id,"blog.delete","blog_post",id);revalidatePath("/","layout");redirect("/admin/blog");
}
export async function setStudentActive(id:string,active:boolean,_prev:FormState,_form:FormData):Promise<FormState> {
  await requireAdmin();if(!z.uuid().safeParse(id).success||typeof active!=="boolean")return {status:"error",message:"Invalid student."};
  const db=await createClient();const {error}=await db.rpc("admin_set_student_active",{p_user_id:id,p_active:active});
  if(error)return {status:"error",message:"Could not change student access."};
  revalidatePath("/admin/students");return {status:"success",message:active?"Access restored.":"Access suspended."};
}
export async function saveSettings(_prev:FormState,form:FormData):Promise<FormState> {
  const admin=await requireAdmin();const raw={support_email:field(form,"support_email").trim(),announcement:field(form,"announcement").trim(),commerce_enabled:field(form,"commerce_enabled"),guest_mock_enabled:field(form,"guest_mock_enabled"),guest_mock_limit:field(form,"guest_mock_limit"),guest_network_daily_limit:field(form,"guest_network_daily_limit")};
  const parsed=z.object({support_email:z.union([z.email().max(254),z.literal("")]),announcement:z.string().max(500),commerce_enabled:z.enum(["true","false"]).transform(v=>v==="true"),guest_mock_enabled:z.enum(["true","false"]).transform(v=>v==="true"),guest_mock_limit:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(100)),guest_network_daily_limit:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(1000))}).safeParse(raw);
  if(!parsed.success)return {status:"error",values:raw,fieldErrors:z.flattenError(parsed.error).fieldErrors};
  const db=await createClient();const {data,error}=await db.from("site_settings").update(parsed.data).eq("id",true).select("id").maybeSingle();
  if(error||!data)return {status:"error",message:"Could not save settings.",values:raw};
  await logAdminAction(db,admin.id,"settings.save","site_settings","true");revalidatePath("/","layout");return {status:"success",message:"Settings saved.",values:raw};
}
export async function setPracticeVisibility(id:string,_prev:FormState,form:FormData):Promise<FormState> {
  const admin=await requireAdmin();const parsed=z.object({slug:z.string().max(150).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),is_practice:z.enum(["true","false"])}).safeParse({slug:field(form,"slug"),is_practice:field(form,"is_practice")});
  if(!z.uuid().safeParse(id).success||!parsed.success)return {status:"error",message:"Use a valid slug and visibility."};
  const db=await createClient();const {data,error}=await db.from("questions").update({slug:parsed.data.slug,is_practice:parsed.data.is_practice==="true"}).eq("id",id).select("id").maybeSingle();
  if(error||!data)return {status:"error",message:"Could not save practice settings. Slugs must be unique."};
  await logAdminAction(db,admin.id,"question.practice","question",id);revalidatePath("/","layout");return {status:"success",message:"Practice settings saved."};
}
export async function assignLessonQuestion(lessonId:string,remove:boolean,_prev:FormState,form:FormData):Promise<FormState> {
  await requireAdmin();const questionId=field(form,"question_id");if(!z.uuid().safeParse(lessonId).success||!z.uuid().safeParse(questionId).success||typeof remove!=="boolean")return {status:"error",message:"Choose a question."};
  const db=await createClient();const {error}=await db.rpc("assign_lesson_question",{p_lesson_id:lessonId,p_question_id:questionId,p_remove:remove});
  if(error)return {status:"error",message:"Could not update practice. Choose a published practice question."};
  revalidatePath("/","layout");return {status:"success",message:remove?"Question removed.":"Question assigned."};
}
