"use client";
import { useActionState, useSyncExternalStore, useState } from "react";
import { submitPractice, checkGuestPractice } from "@/server/practice/actions";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { PracticeQuestion } from "@/server/practice/queries";
const subscribeDraft = () => () => {};
export function PracticeAnswer({question, authenticated = true}:{question:PracticeQuestion; authenticated?:boolean}) {
  const [signedState,signedAction]=useActionState(submitPractice.bind(null,question.id),initialFormState);
  const [guestState,guestAction,guestPending]=useActionState(checkGuestPractice.bind(null,question.id),initialFormState);
  const state=authenticated?signedState:guestState;
  const saved=useSyncExternalStore(subscribeDraft,()=>{try{return localStorage.getItem(`practice:${question.id}`)??"";}catch{return "";}},()=>"");
  const [edited,setAnswer]=useState<string>();
  const answer=edited??saved;
  function update(value:string) {setAnswer(value);try {localStorage.setItem(`practice:${question.id}`,value);} catch {}}
  return <form action={authenticated ? signedAction : guestAction} className="space-y-5">
    {state.status==="error" && state.message && <Alert variant="error">{state.message}</Alert>}
    {question.type==="mcq" ? <fieldset className="space-y-3"><legend className="mb-3 font-semibold">Choose your answer</legend>{question.options.map(o=><label key={o.key} className="flex gap-3 rounded border border-[var(--color-line)] p-4"><input required type="radio" name="answer" value={o.key} checked={answer===o.key} onChange={()=>update(o.key)}/><span>{o.key}. {o.text}</span></label>)}</fieldset> : <div className="space-y-3"><label htmlFor="answer" className="block font-semibold">Your solution</label><textarea id="answer" name="answer" required maxLength={20000} rows={14} value={answer} onChange={e=>update(e.target.value)} className="w-full rounded border bg-white p-4 font-mono text-sm"/><p className="text-sm">Write and save your solution, then compare it with the explanation. Solutions are not executed or automatically graded.</p></div>}
    {authenticated ? <SubmitButton>Submit and see explanation</SubmitButton> : <SubmitButton disabled={guestPending}>Check answer for free</SubmitButton>}
    {!authenticated && state.status==="success" && <div role="status" className="rounded-lg border border-[var(--color-line)] bg-white p-5"><p className="font-semibold">{state.message}</p><p className="mt-2 text-sm">Correct option: {state.values?.correct_answer}</p>{state.values?.explanation&&<p className="mt-3 whitespace-pre-line text-sm leading-6">{state.values.explanation}</p>}</div>}
  </form>;
}
