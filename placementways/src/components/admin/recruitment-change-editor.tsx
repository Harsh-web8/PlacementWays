"use client";
import { useActionState, useState } from "react";
import { addReviewedFieldChange, type AdminResult } from "@/server/recruitment/actions";

type Target={kind:"role"|"drive"|"round"|"round_new";id:string;label:string};
const keys:Record<Target["kind"],string[]>={
  role:["title","description","responsibilities","salary_details","eligibility","required_skills"],
  drive:["title","notes","application_url","opens_at","closes_at","drive_status"],
  round:["name","round_type","description","topics","question_count","duration_minutes","marking_rules"],
  round_new:["create"],
};
const initial:AdminResult={ok:false,message:""};
const input="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm";

export function RecruitmentChangeEditor({proposalId,evidence,targets}:{proposalId:string;evidence:string;targets:Target[]}){
  const [state,action,pending]=useActionState(addReviewedFieldChange,initial);
  const [selected,setSelected]=useState(0);
  const target=targets[selected];
  const [field,setField]=useState("title");
  if(!target)return <p className="text-xs text-amber-700">Assign a company role or drive to the monitored source to propose structured changes.</p>;
  const fields=keys[target.kind];
  const currentField=fields.includes(field)?field:fields[0];
  return <details className="mt-4 rounded-lg border bg-[var(--color-paper)] p-4 text-sm">
    <summary className="cursor-pointer font-semibold">Add or correct a supported structured field</summary>
    <p className="mt-2 text-xs text-[var(--color-ink)]/70">Use an exact quote from the captured source. Enter text for ordinary fields, a number for counts, JSON arrays for topics/skills, or a JSON object for a new round. Changes remain pending until approved.</p>
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="proposal_id" value={proposalId}/>
      <input type="hidden" name="target_kind" value={target.kind}/>
      <input type="hidden" name="target_id" value={target.id}/>
      <label className="block space-y-1"><span>Target</span><select className={input} value={selected} onChange={e=>{setSelected(Number(e.target.value));setField("");}}>
        {targets.map((t,i)=><option key={t.kind+t.id} value={i}>{t.label}</option>)}
      </select></label>
      <label className="block space-y-1"><span>Field</span><select className={input} name="field_key" value={currentField} onChange={e=>setField(e.target.value)}>
        {fields.map(f=><option key={f} value={f}>{f.replaceAll("_"," ")}</option>)}
      </select></label>
      <label className="block space-y-1"><span>Proposed value</span><textarea required name="value" className={input} rows={3} placeholder={target.kind==="round_new"?'{"round_number":2,"name":"Technical Interview","round_type":"interview"}':currentField==="topics"||currentField==="required_skills"?'["Java","SQL"]':"New supported value"}/></label>
      <label className="block space-y-1"><span>Exact source evidence (8+ characters)</span><textarea required name="evidence_quote" className={input} defaultValue={evidence.slice(0,1000)} rows={2}/></label>
      <button disabled={pending} className="rounded-lg bg-[var(--color-ink)] px-4 py-2 font-semibold text-white disabled:opacity-50">{pending?"Saving…":"Save proposed field"}</button>
      {state.message&&<p role="status" className={state.ok?"text-green-700":"text-red-700"}>{state.message}</p>}
    </form>
  </details>;
}
