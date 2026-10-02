import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CodingResultPanel } from "@/components/coding/result";
export default async function Page({params}:PageProps<"/coding/submissions/[submissionId]">){
 const user=await requireUser();const {submissionId}=await params;if(!z.uuid().safeParse(submissionId).success)notFound();
 const {data,error}=await (await createClient()).from("coding_submissions").select("id,status,kind,passed,total,feedback,source_code,language_key,created_at").eq("id",submissionId).eq("user_id",user.id).maybeSingle();
 if(error)throw new Error("Could not load submission.");if(!data)notFound();return <CodingResultPanel initial={data}/>;
}
