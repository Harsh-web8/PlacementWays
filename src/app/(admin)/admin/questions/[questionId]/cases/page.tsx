import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LearningForm,type LearningField } from "@/components/admin/learning-form";
import { ActionForm } from "@/components/learning/action-form";
import { saveTestCase,deleteTestCase } from "@/server/coding/actions";
const fields:LearningField[]=[{name:"input",label:"Standard input",type:"textarea"},{name:"expected_output",label:"Expected standard output",type:"textarea"},{name:"position",label:"Position (1–20)",type:"number"},{name:"is_sample",label:"Visibility",options:[{value:"true",label:"Public example"},{value:"false",label:"Hidden test"}]}];
export default async function Page({params}:PageProps<"/admin/questions/[questionId]/cases">){
 await requireAdmin();const {questionId}=await params;if(!z.uuid().safeParse(questionId).success)notFound();const db=await createClient();const [q,cases]=await Promise.all([db.from("questions").select("question_text,question_type").eq("id",questionId).maybeSingle(),db.from("coding_test_cases").select("*").eq("question_id",questionId).order("position")]);
 if(q.error||cases.error)throw new Error("Could not load test cases.");if(!q.data||q.data.question_type==="mcq")notFound();
 return <div className="space-y-8"><h1 className="font-serif text-4xl">Coding test cases</h1><p className="whitespace-pre-wrap">{q.data.question_text}</p><p>Provide at least one public example and one hidden test. Existing submissions keep a snapshot when cases change. Document the input/output contract in the question.</p><LearningForm fields={fields} values={{position:String(Math.min(20,(cases.data.at(-1)?.position??0)+1)),is_sample:"false"}} action={saveTestCase.bind(null,questionId,null)}/>{cases.data.map(c=><section className="space-y-4 rounded border p-5" key={c.id}><h2>Test {c.position}</h2><LearningForm fields={fields} values={{input:c.input,expected_output:c.expected_output,position:String(c.position),is_sample:String(c.is_sample)}} action={saveTestCase.bind(null,questionId,c.id)}/><ActionForm label="Delete case" confirm="Delete this test case?" action={deleteTestCase.bind(null,c.id)}/></section>)}</div>;
}
