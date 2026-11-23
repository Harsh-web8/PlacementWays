"use client";
import { useState } from "react";
import { checkGuidedSql,runGuidedSql,SQL_COLUMNS,SQL_EXERCISES,SQL_ROWS,type SqlOutcome } from "@/lib/sql-guided";
export function SqlLab(){
 const [id,setId]=useState(SQL_EXERCISES[0].id);
 const [query,setQuery]=useState("SELECT ");
 const [outcome,setOutcome]=useState<SqlOutcome|null>(null);
 const [message,setMessage]=useState("");
 const exercise=SQL_EXERCISES.find(x=>x.id===id)!;
 function choose(nextId:string){setId(nextId);setQuery("SELECT ");setOutcome(null);setMessage("");}
 function run(grade:boolean){try{const verdict=grade?checkGuidedSql(query,id):null;const value=verdict?.result??runGuidedSql(query);setOutcome(value);setMessage(grade?(verdict?.passed?"Correct! Your output matches the target result.":"Output differs from the target. Try the hint and review the rows."):"Query executed in the local practice engine.");}catch(e){setOutcome(null);setMessage(e instanceof Error?e.message:"Invalid query");}}
 return <div className="space-y-7">
  <section className="rounded-xl border bg-white p-5 shadow-sm">
   <h2 className="text-xl font-semibold">Choose an exercise</h2>
   <label htmlFor="sql-exercise" className="mt-4 block text-sm">Question</label>
   <select id="sql-exercise" className="mt-2 w-full rounded-lg border px-3 py-3" value={id} onChange={e=>choose(e.target.value)}>{SQL_EXERCISES.map((e,i)=><option value={e.id} key={e.id}>{i+1}. {e.title}</option>)}</select>
   <p className="mt-4 text-sm">{exercise.prompt}</p>
   <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Need a hint?</summary><p className="mt-2">{exercise.hint}</p></details>
  </section>
  <section className="rounded-xl border bg-white p-5">
   <h2 className="text-xl font-semibold">Available table: employees</h2>
   <p className="mt-1 text-sm text-slate-600">Six practice rows. The evaluator runs locally in your browser; no live database is accessed.</p>
   <div role="region" aria-label="Employee sample rows" tabIndex={0} className="mt-4 overflow-x-auto">
    <table className="w-full border-collapse text-left text-sm"><thead><tr>{SQL_COLUMNS.map(c=><th scope="col" key={c} className="border-b p-2">{c}</th>)}</tr></thead><tbody>{SQL_ROWS.map((r,i)=><tr key={i}>{SQL_COLUMNS.map(c=><td key={c} className="border-b p-2">{r[c]}</td>)}</tr>)}</tbody></table>
   </div>
  </section>
  <section className="rounded-xl border bg-white p-5">
   <label htmlFor="sql-query" className="font-semibold">Write your SQL query</label>
   <textarea id="sql-query" spellCheck={false} value={query} onChange={e=>setQuery(e.target.value)} maxLength={1800} rows={5} className="mt-3 w-full rounded-lg border bg-slate-950 p-4 font-mono text-sm text-white"/>
   <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={()=>run(false)} className="rounded-lg border px-4 py-2 font-semibold">Run query</button><button type="button" onClick={()=>run(true)} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Check answer</button><button type="button" onClick={()=>{setQuery(exercise.sample);setOutcome(null);setMessage("Showing reference solution.");}} className="rounded-lg border px-4 py-2">Show solution</button></div>
   <p role="status" aria-live="polite" className="mt-4 text-sm">{message}</p>
   {outcome&&<div className="mt-4"><h3 id="sql-result-heading" className="font-semibold">Query result ({outcome.rows.length} rows)</h3><div role="region" aria-labelledby="sql-result-heading" tabIndex={0} className="mt-2 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr>{outcome.columns.map(c=><th scope="col" key={c} className="border p-2 text-left">{c}</th>)}</tr></thead><tbody>{outcome.rows.map((row,i)=><tr key={i}>{outcome.columns.map(c=><td className="border p-2" key={c}>{String(row[c]??"")}</td>)}</tr>)}</tbody></table></div></div>}
  </section>
 </div>;
}
