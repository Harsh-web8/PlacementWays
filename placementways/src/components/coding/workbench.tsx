"use client";
import { useActionState,useState,useSyncExternalStore } from "react";
import { executeCode } from "@/server/coding/actions";
import { initialFormState } from "@/lib/form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
const subscribe=()=>()=>{};
export function CodeWorkbench({questionId,enabled,languages}:{questionId:string;enabled:boolean;languages:{key:string;name:string}[]}){
 const [state,action,pending]=useActionState(executeCode.bind(null,questionId),initialFormState);
 const [language,setLanguage]=useState(languages[0]?.key??"");
 const key=`code:${questionId}:${language}`;
 const saved=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)??"";}catch{return "";}},()=>"");
 const [draft,setDraft]=useState<{key:string;code:string}|null>(null);
 const code=draft?.key===key?draft.code:saved;
 function edit(value:string){setDraft({key,code:value});try{localStorage.setItem(key,value);}catch{}}
 return <form action={action} className="space-y-4">
  {state.message&&<Alert variant="error">{state.message}</Alert>}
  <label className="block">Language<select name="language" value={language} onChange={e=>setLanguage(e.target.value)} className="ml-3 rounded border p-2">{languages.map(l=><option key={l.key} value={l.key}>{l.name}</option>)}</select></label>
  <p className="text-sm">Read standard input and print your answer to standard output. Java programs must use a Main class. Each test has a 2 second CPU limit and 128 MB memory limit.</p>
  <label htmlFor="source" className="block font-semibold">Your code</label><textarea id="source" name="source" rows={18} maxLength={20000} value={code} onChange={e=>edit(e.target.value)} spellCheck={false} className="w-full rounded border bg-white p-4 font-mono text-sm"/>
  {!enabled&&<p>Code execution is temporarily unavailable. You can still work on your solution.</p>}
  <div className="flex flex-wrap gap-3"><Button type="submit" name="kind" value="run" disabled={pending||!enabled||!language}>Run examples</Button><Button type="submit" name="kind" value="submit" disabled={pending||!enabled||!language}>Submit for grading</Button></div>
  <p className="text-xs text-slate-600">No login required. Anonymous runs use fair-use quotas and a secure isolated compiler. Draft code is saved in this browser.</p>
  <p className="text-sm">Submitting checks public and hidden tests. Without an account, execution results are available in this browser for a limited period; no cross-device history is stored.</p>
 </form>;
}
