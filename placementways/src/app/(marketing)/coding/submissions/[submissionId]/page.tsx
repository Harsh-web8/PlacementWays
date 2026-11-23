import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { guestClient, guestHash } from "@/server/access/guest";
import { CodingResultPanel } from "@/components/coding/result";
export const metadata={title:"Coding result",robots:{index:false,follow:false}};
export default async function Page({params}:PageProps<"/coding/submissions/[submissionId]">){
 const {submissionId}=await params;
 if(!z.uuid().safeParse(submissionId).success)notFound();
 const user=await getCurrentUser();
 if(user){
  const {data,error}=await (await createClient()).from("coding_submissions")
   .select("id,status,kind,passed,total,feedback,source_code,language_key,created_at")
   .eq("id",submissionId).eq("user_id",user.id).maybeSingle();
  if(error)throw new Error("Could not load submission.");
  if(data)return <div className="mx-auto max-w-3xl p-6"><CodingResultPanel initial={data}/></div>;
 }
 const token=await guestHash();if(!token)notFound();
 const {data,error}=await guestClient().rpc("get_guest_coding_submission",{p_guest_hash:token,p_submission_id:submissionId});
 if(error)throw new Error("Could not load submission.");
 if(!data)notFound();
 return <div className="mx-auto max-w-3xl p-6"><CodingResultPanel initial={data as unknown as import("@/components/coding/result").CodingResult}/></div>;
}
