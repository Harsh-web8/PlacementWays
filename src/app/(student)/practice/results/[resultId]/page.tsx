import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireUser} from "@/server/auth/session";
import {createClient} from "@/lib/supabase/server";
export default async function Page({params}:PageProps<"/practice/results/[resultId]">) {
  const user=await requireUser();const {resultId}=await params;if(!z.uuid().safeParse(resultId).success)notFound();
  const db=await createClient();const {data,error}=await db.from("practice_attempts").select("*").eq("id",resultId).eq("user_id",user.id).maybeSingle();
  if(error)throw new Error("Could not load your result.");if(!data)notFound();
  return <div className="max-w-3xl space-y-6"><h1 className="font-serif text-4xl">{data.is_correct===null?"Solution saved":data.is_correct?"Correct answer":"Keep practising"}</h1><p>{data.is_correct===null?"Compare your approach below. This solution has not been automatically graded.":data.correct_answer ? `Correct option: ${data.correct_answer}` : "Your code was evaluated against the test cases."}</p><h2 className="font-semibold">Your answer</h2><pre className="whitespace-pre-wrap break-words rounded border p-4">{data.selected_answer}</pre><h2 className="font-semibold">Explanation</h2><p className="whitespace-pre-wrap leading-8">{data.explanation || "An explanation has not been added yet."}</p><div className="flex gap-6"><Link className="underline" href={`/practice?category=${data.category_id}`}>Practise this topic</Link><Link className="underline" href="/progress">View progress</Link></div></div>;
}
