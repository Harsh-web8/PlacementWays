import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";
import { DIFFICULTIES, QUESTION_TYPES } from "@/lib/validation/question";
export const practiceQuestionSchema = z.object({
  id:z.uuid(),slug:z.string(),text:z.string(),type:z.enum(QUESTION_TYPES),difficulty:z.enum(DIFFICULTIES),
  category_id:z.uuid(),category_name:z.string(),options:z.array(z.object({key:z.string(),text:z.string()})),
});
export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;
export type PracticeFilters = { page:number; category?:string; difficulty?:string; q?:string; coding?:boolean; lesson?:string };
export async function listPractice(filters:PracticeFilters) {
  if (!readSupabaseEnv().ok) return {questions:[],total:0,categories:[]};
  const db=await createClient();
  const categories=await db.from("categories").select("id,name,parent_id").order("sort_order").order("name");
  if(categories.error) throw new Error("Could not load practice topics.");
  let query=db.from("practice_questions").select("*",{count:"exact"}).order("id").range((filters.page-1)*20,filters.page*20-1);
  if(filters.coding) query=query.in("question_type",["coding","debugging"]);
  if(filters.category && z.uuid().safeParse(filters.category).success) query=query.or(`category_id.eq.${filters.category},subject_id.eq.${filters.category}`);
  if(DIFFICULTIES.includes(filters.difficulty as typeof DIFFICULTIES[number])) query=query.eq("difficulty",filters.difficulty as typeof DIFFICULTIES[number]);
  if(filters.q) query=query.ilike("question_text",`%${filters.q.slice(0,200).replace(/[%_\\]/g,"\\$&")}%`);
  if(filters.lesson) {
    if(!z.uuid().safeParse(filters.lesson).success) return {questions:[],total:0,categories:categories.data};
    const links=await db.from("lesson_questions").select("question_id").eq("lesson_id",filters.lesson).limit(200);
    if(links.error) throw new Error("Could not load lesson practice.");
    if(!links.data.length) return {questions:[],total:0,categories:categories.data};
    query=query.in("id",links.data.map(l=>l.question_id));
  }
  const {data,error,count}=await query;
  if(error) throw new Error("Practice is temporarily unavailable.");
  return {questions:data??[],total:count??0,categories:categories.data};
}
export async function getPracticeQuestion(slug:string) {
  if(!readSupabaseEnv().ok) return null;
  const db=await createClient();
  const {data,error}=await db.rpc("get_practice_question",{p_slug:slug});
  if(error) throw new Error("Practice is temporarily unavailable.");
  return data ? practiceQuestionSchema.parse(data) : null;
}
