"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/server/admin/audit";
import type { FormState } from "@/lib/form-state";
export async function uploadLessonResource(id:string,_prev:FormState,form:FormData):Promise<FormState>{
 const admin=await requireAdmin();const file=form.get("file");
 if(!z.uuid().safeParse(id).success||!(file instanceof File)||file.type!=="application/pdf"||file.size===0||file.size>10485760)return {status:"error",message:"Choose a PDF up to 10 MB."};
 const bytes=new Uint8Array(await file.arrayBuffer());if(Buffer.from(bytes.slice(0,5)).toString()!=="%PDF-")return {status:"error",message:"The file is not a PDF."};
 const db=await createClient();const current=await db.from("lesson_contents").select("private_resource_path").eq("lesson_id",id).maybeSingle();
 if(current.error||!current.data)return {status:"error",message:"Save the lesson before uploading a resource."};
 const path=`lessons/${id}/${randomUUID()}.pdf`;const storage=serviceClient().storage.from("learning-resources");
 const upload=await storage.upload(path,bytes,{contentType:"application/pdf",upsert:false});
 if(upload.error)return {status:"error",message:"Upload failed. Check private storage configuration."};
 const saved=await db.from("lesson_contents").update({private_resource_path:path}).eq("lesson_id",id).select("lesson_id").maybeSingle();
 if(saved.error||!saved.data){await storage.remove([path]);return {status:"error",message:"Could not attach the PDF."};}
 if(current.data.private_resource_path)await storage.remove([current.data.private_resource_path]);
 await logAdminAction(db,admin.id,"lesson.resource.upload","lesson",id);revalidatePath("/","layout");return {status:"success",message:"Private PDF attached."};
}
