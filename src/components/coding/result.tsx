"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
export type CodingResult={id:string;status:string;kind:string;passed:number;total:number;feedback:unknown;source_code:string;language_key:string;created_at:string};
export function CodingResultPanel({initial}:{initial:CodingResult}){
 const [result,setResult]=useState(initial);const [error,setError]=useState(false);
 const running=result.status==="queued"||result.status==="running";
 useEffect(()=>{
  if(!running)return;let stopped=false;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function poll(){try{const response=await fetch(`/api/coding/submissions/${initial.id}`,{cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error();const data=await response.json();if(!stopped){setResult(data);setError(false);}}catch{if(!stopped)setError(true);}finally{if(!stopped)timer=setTimeout(poll,3000);}}
  timer=setTimeout(poll,1500);return ()=>{stopped=true;clearTimeout(timer);controller.abort();};
 },[initial.id,running]);
 const feedback=Array.isArray(result.feedback)?result.feedback as {case:number;sample:boolean;status:string;stdout?:string;stderr?:string;compile_output?:string}[]:[];
 return <div className="space-y-5"><h1 className="font-serif text-4xl">{result.kind==="run"?"Example run":"Coding submission"}</h1><p role="status" className="text-xl capitalize">{result.status.replaceAll("_"," ")}</p>
  {error&&<p role="alert">Connection interrupted. Retrying automatically; your submission is saved.</p>}
  {result.status==="error"&&<p>The execution service could not complete this request. Please try again later.</p>}
  {!running&&<p>{result.passed} / {result.total} tests passed</p>}
  {feedback.map(f=><section className="rounded border p-4" key={f.case}><h2>Test {f.case} ({f.sample?"example":"hidden"}): {f.status.replaceAll("_"," ")}</h2>{f.stdout&&<pre className="whitespace-pre-wrap break-words">{f.stdout}</pre>}{(f.stderr||f.compile_output)&&<pre className="whitespace-pre-wrap break-words">{f.compile_output||f.stderr}</pre>}</section>)}
  <h2 className="font-semibold">Your code ({result.language_key})</h2><pre className="overflow-x-auto rounded border p-4">{result.source_code}</pre><Link href="/coding/history" className="underline">Submission history</Link>
 </div>;
}
