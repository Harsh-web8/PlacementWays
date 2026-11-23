"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { field, type FormState } from "@/lib/form-state";
import { guestClient, guestHash, networkRateHash } from "@/server/access/guest";
export async function submitPractice(questionId:string,_previous:FormState,form:FormData):Promise<FormState> {
  await requireUser();
  const answer=field(form,"answer").trim();
  if(!z.uuid().safeParse(questionId).success || !answer || answer.length>20000) return {status:"error",message:"Enter an answer (maximum 20,000 characters)."};
  const db=await createClient();
  const {data,error}=await db.rpc("submit_practice",{p_question_id:questionId,p_answer:answer});
  if(error || !data) return {status:"error",message:error?.code==="P0001" ? "Please wait a minute before submitting again." : "Could not save your answer. Check the selection and try again."};
  redirect(`/practice/results/${data}`);
}


/** Anonymous MCQ checks; solution never exposed through the public question query. */
export async function checkGuestPractice(questionId:string,_previous:FormState,form:FormData):Promise<FormState> {
  const answer=field(form,"answer").trim();
  if(!z.uuid().safeParse(questionId).success || !answer || answer.length>64)
    return {status:"error",message:"Choose an answer before checking."};
  try {
    const tokenHash=await guestHash(true);
    if(!tokenHash)return {status:"error",message:"Guest session unavailable."};
    const {data,error}=await guestClient().rpc("guest_practice_answer",{
      p_question_id:questionId,p_answer:answer,p_token_hash:tokenHash,p_network_hash:await networkRateHash(),
    });
    if(error||!data||typeof data!=="object"||Array.isArray(data))
      return {status:"error",message:error?.code==="P0001"?"Today's anonymous practice-check limit has been reached.":error?.code==="23514"?"Finish your timed test before checking its answers.":"Practice checks are unavailable. Please try again later."};
    const result=data as {correct?:boolean;correct_answer?:string;explanation?:string};
    if(typeof result.correct!=="boolean" || typeof result.correct_answer!=="string")
      return {status:"error",message:"Could not verify this answer."};
    return {status:"success",message:result.correct?"Correct answer!":"Not quite. Review the explanation below.",
      values:{correct:result.correct?"true":"false",correct_answer:result.correct_answer,explanation:(result.explanation||"").slice(0,10000),answer}};
  } catch {return {status:"error",message:"Anonymous checking is not configured yet. You can still work through the question."};}
}
