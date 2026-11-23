import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { guestClient,guestHash } from "@/server/access/guest";
export async function GET(_request:Request,{params}:RouteContext<"/api/coding/submissions/[submissionId]">){
 const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
 const {submissionId}=await params;
 if(!z.uuid().safeParse(submissionId).success)return Response.json({error:"Not found"},{status:404,headers});
 const user=await getCurrentUser();
 if(user){
  const {data,error}=await (await createClient()).from("coding_submissions")
   .select("id,status,kind,passed,total,feedback,source_code,language_key,created_at")
   .eq("id",submissionId).eq("user_id",user.id).maybeSingle();
  if(error)return Response.json({error:"Unavailable"},{status:503,headers});
  if(data)return Response.json(data,{headers});
 }
 const token=await guestHash();
 if(!token)return Response.json({error:"Not found"},{status:404,headers});
 try{
  const {data,error}=await guestClient().rpc("get_guest_coding_submission",{p_guest_hash:token,p_submission_id:submissionId});
  if(error)return Response.json({error:"Unavailable"},{status:503,headers});
  return data?Response.json(data,{headers}):Response.json({error:"Not found"},{status:404,headers});
 }catch{return Response.json({error:"Unavailable"},{status:503,headers});}
}
