"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { field, type FormState } from "@/lib/form-state";
export async function submitPractice(questionId:string,_previous:FormState,form:FormData):Promise<FormState> {
  await requireUser();
  const answer=field(form,"answer").trim();
  if(!z.uuid().safeParse(questionId).success || !answer || answer.length>20000) return {status:"error",message:"Enter an answer (maximum 20,000 characters)."};
  const db=await createClient();
  const {data,error}=await db.rpc("submit_practice",{p_question_id:questionId,p_answer:answer});
  if(error || !data) return {status:"error",message:error?.code==="P0001" ? "Please wait a minute before submitting again." : "Could not save your answer. Check the selection and try again."};
  redirect(`/practice/results/${data}`);
}
