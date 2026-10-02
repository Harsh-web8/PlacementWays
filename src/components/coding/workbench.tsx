"use client";
import { useActionState,useState,useSyncExternalStore } from "react";
import Link from "next/link";
import { executeCode } from "@/server/coding/actions";
import { initialFormState } from "@/lib/form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
const subscribe=()=>()=>{};
export function CodeWorkbench({questionId,slug,authenticated,enabled,languages}:{questionId:string;slug:string;authenticated:boolean;enabled:boolean;languages:{key:string;name:string}[]}){
 const [state,action,pending]=useActionState(executeCode.bind(null,questionId),initialFormState);
 const [language,setLanguage]=useState(languages[0]?.key??"");
 const key=`code:${questionId}:${language}`;
 const saved=useSyncExternalStore(subscribe,()=>{try{return sessionStorage.getItem(key)??"";}catch{return "";}},()=>"");
 const [draft,setDraft]=useState<{key:string;code:string}|null>(null);
 const code=draft?.key===key?draft.code:saved;
 function edit(value:string){setDraft({key,code:value});try{sessionStorage.setItem(key,value);}catch{}}
 return <form action={authenticated?action:undefined} onSubmit={e=>{if(!authenticated)e.preventDefault();}} className="space-y-4">
  {state.message&&<Alert variant="error">{state.message}</Alert>}
  <label className="block">Language<select name="language" value={language} onChange={e=>setLanguage(e.target.value)} className="ml-3 rounded border p-2">{languages.map(l=><option key={l.key} value={l.key}>{l.name}</option>)}</select></label>
  <p className="text-sm">Read standard input and print your answer to standard output. Java programs must use a Main class. Each test has a 2 second CPU limit and 128 MB memory limit.</p>
  <label htmlFor="source" className="block font-semibold">Your code</label><textarea id="source" name="source" rows={18} maxLength={20000} value={code} onChange={e=>edit(e.target.value)} spellCheck={false} className="w-full rounded border bg-white p-4 font-mono text-sm"/>
  {!enabled&&<p>Code execution is temporarily unavailable. You can still work on your solution.</p>}
  {authenticated?<div className="flex gap-3"><Button type="submit" name="kind" value="run" disabled={pending||!enabled||!language}>Run examples</Button><Button type="submit" name="kind" value="submit" disabled={pending||!enabled||!language}>Submit for grading</Button></div>:<Link className="underline" href={`/login?next=${encodeURIComponent(`/questions/${slug}`)}`}>Log in to run or submit your code</Link>}
  <p className="text-sm">Submitting checks public and hidden tests. Only submitted solutions update your preparation progress.</p>
 </form>;
}
