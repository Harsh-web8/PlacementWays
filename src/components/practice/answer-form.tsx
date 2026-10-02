"use client";
import Link from "next/link";
import { useActionState, useSyncExternalStore, useState } from "react";
import { submitPractice } from "@/server/practice/actions";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { PracticeQuestion } from "@/server/practice/queries";
const subscribeDraft = () => () => {};
export function PracticeAnswer({question, authenticated = true}:{question:PracticeQuestion; authenticated?:boolean}) {
  const [state,action]=useActionState(submitPractice.bind(null,question.id),initialFormState);
  const saved=useSyncExternalStore(subscribeDraft,()=>{try{return sessionStorage.getItem(`practice:${question.id}`)??"";}catch{return "";}},()=>"");
  const [edited,setAnswer]=useState<string>();
  const answer=edited??saved;
  function update(value:string) {setAnswer(value);try {sessionStorage.setItem(`practice:${question.id}`,value);} catch {}}
  return <form action={authenticated ? action : undefined} onSubmit={e=>{if(!authenticated)e.preventDefault();}} className="space-y-5">
    {state.message && <Alert variant="error">{state.message}</Alert>}
    {question.type==="mcq" ? <fieldset className="space-y-3"><legend className="mb-3 font-semibold">Choose your answer</legend>{question.options.map(o=><label key={o.key} className="flex gap-3 rounded border border-[var(--color-line)] p-4"><input required type="radio" name="answer" value={o.key} checked={answer===o.key} onChange={()=>update(o.key)}/><span>{o.key}. {o.text}</span></label>)}</fieldset> : <div className="space-y-3"><label htmlFor="answer" className="block font-semibold">Your solution</label><textarea id="answer" name="answer" required maxLength={20000} rows={14} value={answer} onChange={e=>update(e.target.value)} className="w-full rounded border bg-white p-4 font-mono text-sm"/><p className="text-sm">Write and save your solution, then compare it with the explanation. Solutions are not executed or automatically graded.</p></div>}
    {authenticated ? <SubmitButton>Submit and see explanation</SubmitButton> : <Link className="inline-block underline" href={`/login?next=${encodeURIComponent(`/questions/${question.slug}`)}`}>Log in to submit and save your progress</Link>}
  </form>;
}
