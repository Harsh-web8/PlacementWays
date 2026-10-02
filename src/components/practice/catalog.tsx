import Link from "next/link";
import { listPractice } from "@/server/practice/queries";
import { DIFFICULTIES,DIFFICULTY_LABELS } from "@/lib/validation/question";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
export async function PracticeCatalog({searchParams,coding=false}:{searchParams:Promise<Record<string,string|string[]|undefined>>;coding?:boolean}) {
  const sp=await searchParams;
  const str=(key:string)=>typeof sp[key]==="string"?sp[key] as string:"";
  const page=Math.min(10000,Math.max(1,Math.floor(Number(str("page"))||1)));
  const filters={category:str("category"),difficulty:str("difficulty"),q:str("q"),lesson:str("lesson")};
  const result=await listPractice({...filters,page,coding});
  const href=(p:number)=>`${coding?"/coding":"/practice"}?${new URLSearchParams({...filters,page:String(p)})}`;
  return <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
    <h1 className="font-serif text-4xl">{coding?"Coding practice":"Practice questions"}</h1>
    <p>{coding?"Build your approach, write a solution and study the explanation.":"Choose a topic, practise at your level and learn from each answer."}</p>
    <form className="grid gap-4 rounded border p-5 sm:grid-cols-4">
      {filters.lesson && <input type="hidden" name="lesson" value={filters.lesson}/>}
      <label>Search<Input name="q" defaultValue={filters.q} maxLength={200}/></label>
      <label>Topic<Select name="category" defaultValue={filters.category}><option value="">All topics</option>{result.categories.map(c=><option key={c.id} value={c.id}>{c.parent_id?"— ":""}{c.name}</option>)}</Select></label>
      <label>Difficulty<Select name="difficulty" defaultValue={filters.difficulty}><option value="">All levels</option>{DIFFICULTIES.map(d=><option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}</Select></label>
      <Button className="self-end">Apply filters</Button>
    </form>
    <p>{result.total} questions</p>
    {!result.questions.length && <p>No questions match these filters yet.</p>}
    <ul className="space-y-4">{result.questions.map(q=><li key={q.id} className="rounded border p-5"><Link href={`/questions/${q.slug}`} className="font-medium underline">{q.question_text}</Link><p className="mt-2 text-sm">{q.category_name} · {q.difficulty && DIFFICULTY_LABELS[q.difficulty]}</p></li>)}</ul>
    <nav aria-label="Practice pages" className="flex justify-between"><span>{page>1&&<Link className="underline" href={href(page-1)}>Previous</Link>}</span><span>Page {page}</span><span>{page*20<result.total&&<Link className="underline" href={href(page+1)}>Next</Link>}</span></nav>
  </div>;
}
