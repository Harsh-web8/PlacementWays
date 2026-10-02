import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
export async function GET(_request:Request,{params}:RouteContext<"/api/coding/submissions/[submissionId]">){
 const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
 const user=await getCurrentUser();if(!user)return Response.json({error:"Sign in required"},{status:401,headers});
 const {submissionId}=await params;if(!z.uuid().safeParse(submissionId).success)return Response.json({error:"Not found"},{status:404,headers});
 const {data,error}=await (await createClient()).from("coding_submissions").select("id,status,kind,passed,total,feedback,source_code,language_key,created_at").eq("id",submissionId).eq("user_id",user.id).maybeSingle();
 if(error)return Response.json({error:"Unavailable"},{status:503,headers});if(!data)return Response.json({error:"Not found"},{status:404,headers});return Response.json(data,{headers});
}
