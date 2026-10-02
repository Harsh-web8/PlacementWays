import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
export async function GET(_request:Request,{params}:RouteContext<"/api/lessons/[lessonId]/resource">){
 const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"};const {lessonId}=await params;
 if(!z.uuid().safeParse(lessonId).success)return new Response("Not found",{status:404,headers});
 const db=await createClient();const access=await db.rpc("can_read_lesson",{p_lesson_id:lessonId});
 if(access.error||!access.data)return new Response("Not found",{status:404,headers});
 const content=await db.from("lesson_contents").select("private_resource_path").eq("lesson_id",lessonId).maybeSingle();
 if(content.error||!content.data?.private_resource_path)return new Response("Not found",{status:404,headers});
 try{const {data,error}=await serviceClient().storage.from("learning-resources").createSignedUrl(content.data.private_resource_path,60,{download:true});if(error||!data)throw new Error();return new Response(null,{status:303,headers:{...headers,Location:data.signedUrl}});}
 catch{return new Response("Download temporarily unavailable",{status:503,headers});}
}
