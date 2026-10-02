import { publicMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { CodeWorkbench } from "@/components/coding/workbench";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPracticeQuestion } from "@/server/practice/queries";
import { PracticeAnswer } from "@/components/practice/answer-form";
import { getCurrentUser } from "@/server/auth/session";
import { DIFFICULTY_LABELS } from "@/lib/validation/question";
export default async function Page({params}:PageProps<"/questions/[slug]">) {
  const {slug}=await params;const question=await getPracticeQuestion(slug);if(!question)notFound();
  const user=await getCurrentUser();
  const db=await createClient();
  const coding=question.type!=="mcq";
  const [languages,examples,settings]=coding?await Promise.all([db.from("coding_languages").select("key,name").eq("enabled",true),db.from("coding_examples").select("id,input,expected_output").eq("question_id",question.id).order("position"),db.from("site_settings").select("coding_enabled").eq("id",true).single()]):[{data:[]},{data:[]},{data:null}];
  return <div className="mx-auto max-w-3xl space-y-7 px-6 py-12"><Link className="underline" href="/practice">Practice</Link><h1 className="whitespace-pre-wrap font-serif text-3xl">{question.text}</h1><p>{question.category_name} · {DIFFICULTY_LABELS[question.difficulty]}</p>{coding?<><section className="space-y-3"><h2 className="font-serif text-2xl">Examples</h2>{examples.data?.map(e=><div key={e.id} className="rounded border p-4"><h3>Input</h3><pre className="whitespace-pre-wrap">{e.input}</pre><h3>Output</h3><pre className="whitespace-pre-wrap">{e.expected_output}</pre></div>)}</section><CodeWorkbench questionId={question.id} slug={slug} authenticated={!!user} enabled={settings.data?.coding_enabled??false} languages={languages.data??[]}/></>:<PracticeAnswer question={question} authenticated={!!user}/>}</div>;
}

export async function generateMetadata({params}:PageProps<"/questions/[slug]">){const {slug}=await params;const item=await getPracticeQuestion(slug);return publicMetadata(item?.text??"Question",item?.text,`/questions/${slug}`);}
