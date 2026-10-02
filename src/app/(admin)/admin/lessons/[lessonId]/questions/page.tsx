import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireAdmin} from "@/server/auth/session";
import {createClient} from "@/lib/supabase/server";
import {LearningForm} from "@/components/admin/learning-form";
import {assignLessonQuestion} from "@/server/admin/platform/actions";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
export default async function Page({params,searchParams}:PageProps<"/admin/lessons/[lessonId]/questions">){
 await requireAdmin();const {lessonId}=await params;if(!z.uuid().safeParse(lessonId).success)notFound();const sp=await searchParams;const q=typeof sp.q==="string"?sp.q.slice(0,100):"";const db=await createClient();
 const lesson=await db.from("lessons").select("title").eq("id",lessonId).maybeSingle();if(lesson.error)throw new Error("Could not load lesson.");if(!lesson.data)notFound();
 const [available,assigned]=await Promise.all([db.from("practice_questions").select("id,question_text").ilike("question_text",`%${q.replace(/[%_\\]/g,"\\$&")}%`).order("id").limit(100),db.from("lesson_questions").select("question_id,questions(question_text)").eq("lesson_id",lessonId)]);
 if(available.error||assigned.error)throw new Error("Could not load practice assignments.");
 return <div className="space-y-7"><Link className="underline" href={`/admin/lessons/${lessonId}`}>Back to lesson</Link><h1 className="font-serif text-3xl">Practice: {lesson.data.title}</h1><form className="flex gap-4"><label>Search available questions<Input name="q" defaultValue={q}/></label><Button className="self-end">Search</Button></form><p>Showing up to 100 matches. Refine your search to find another question.</p><LearningForm action={assignLessonQuestion.bind(null,lessonId,false)} values={{}} fields={[{name:"question_id",label:"Published practice question",options:[{value:"",label:"Choose question"},...available.data.filter(x=>!assigned.data.some(a=>a.question_id===x.id)).map(x=>({value:x.id!,label:x.question_text!}))]}]}/><h2 className="font-semibold">Assigned questions</h2><LearningForm action={assignLessonQuestion.bind(null,lessonId,true)} values={{}} fields={[{name:"question_id",label:"Remove assignment",options:[{value:"",label:"Choose question"},...assigned.data.map(x=>({value:x.question_id,label:x.questions.question_text}))]}]}/></div>;
}
