"use client";

import { useActionState, useState } from "react";
import { ArrowUpRight, CheckCircle2, Info, Link2, ShieldAlert } from "lucide-react";
import type { AdminResult } from "@/server/recruitment/actions";
import { addRecruitmentRole, addRecruitmentDrive, addRecruitmentRound, addWatchSource } from "@/server/recruitment/actions";

type Option = { id: string; name: string };
type RoleOption = Option & { companyId: string };
type DriveOption = Option & { roleId: string };
const initial: AdminResult = { ok: false, message: "" };
const fieldClass = "min-h-11 w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-ink)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-50";
function Feedback({state}:{state:AdminResult}) {return state.message ? <p role="status" aria-live="polite" className={`rounded-lg p-3 text-sm ${state.ok?"bg-green-50 text-green-800":"bg-red-50 text-red-800"}`}>{state.message}</p> : null;}
function Label({htmlFor,children}:{htmlFor:string;children:React.ReactNode}) {return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[var(--color-ink)]/80">{children}</label>;}
function Panel({number,title,description,children}:{number:number;title:string;description:string;children:React.ReactNode}) {return <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-sm md:p-6"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink)] font-semibold text-white">{number}</div><div><h3 className="font-serif text-xl">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--color-ink)]/65">{description}</p></div></div><div className="mt-5">{children}</div></div>;}
const slugify = (s:string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);

export function RecruitmentSetupForms({companies,roles,drives}:{companies:Option[];roles:RoleOption[];drives:DriveOption[]}) {
  const [roleState,roleAction,rolePending]=useActionState(addRecruitmentRole,initial);
  const [driveState,driveAction,drivePending]=useActionState(addRecruitmentDrive,initial);
  const [roundState,roundAction,roundPending]=useActionState(addRecruitmentRound,initial);
  const [sourceState,sourceAction,sourcePending]=useActionState(addWatchSource,initial);
  const [roleTitle,setRoleTitle]=useState("");
  const [roleSlug,setRoleSlug]=useState("");
  const [sourceCompany,setSourceCompany]=useState("");
  const [sourceRole,setSourceRole]=useState("");
  const [sourceDrive,setSourceDrive]=useState("");
  const matchingRoles=roles.filter(role=>role.companyId===sourceCompany);
  const matchingDrives=drives.filter(drive=>drive.roleId===sourceRole);
  const sourceScope=sourceDrive?"Hiring-drive-specific: structured test-pattern changes":sourceRole?"Role-wide: discover hiring drives; attach a drive for test-pattern updates":"Company-wide: discover new roles and hiring drives";
  return <div className="space-y-6">
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950"><div className="flex items-start gap-3"><Info size={20} className="mt-0.5 shrink-0"/><div><strong>Recommended onboarding order:</strong> verify the company exists, create its job role, add the hiring drive and selection rounds, then register its official monitoring source. The first scan may propose new roles/drives for approval; subsequent changes also create pending proposals. Publishing always requires admin approval.</div></div></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel number={1} title="Create a job role" description="Role guides are grouped under a published company.">
        <form action={roleAction} className="space-y-3">
          <div><Label htmlFor="setup-role-company">Company</Label><select id="setup-role-company" name="company_id" required className={fieldClass}><option value="">Choose company</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
          <div><Label htmlFor="setup-role-title">Job role name</Label><input id="setup-role-title" required maxLength={150} name="title" value={roleTitle} onChange={e=>{setRoleTitle(e.target.value);setRoleSlug(slugify(e.target.value));}} placeholder="Associate Software Engineer" className={fieldClass}/></div>
          <div><Label htmlFor="setup-role-slug">URL slug</Label><input id="setup-role-slug" required maxLength={90} name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={roleSlug} onChange={e=>setRoleSlug(e.target.value)} placeholder="associate-software-engineer" className={fieldClass}/><p className="mt-1 text-xs text-[var(--color-ink)]/55">Auto-filled from the title; edit if needed.</p></div>
          <div><Label htmlFor="setup-role-description">Description (optional)</Label><textarea id="setup-role-description" name="description" maxLength={5000} rows={2} className={fieldClass} placeholder="Supported role overview"/></div>
          <div><Label htmlFor="setup-role-eligibility">Eligibility (optional)</Label><textarea id="setup-role-eligibility" name="eligibility" maxLength={5000} rows={2} className={fieldClass} placeholder="Only source-supported eligibility facts"/></div>
          <button disabled={rolePending} className={buttonClass}>{rolePending?"Saving role…":"Create role"}</button><Feedback state={roleState}/>
        </form>
      </Panel>
      <Panel number={2} title="Create a hiring drive" description="A role can have different test patterns for different batches.">
        <form action={driveAction} className="space-y-3">
          <div><Label htmlFor="setup-drive-role">Role</Label><select id="setup-drive-role" name="role_id" required className={fieldClass}><option value="">Choose role</option>{roles.map(role=><option key={role.id} value={role.id}>{companies.find(c=>c.id===role.companyId)?.name} · {role.name}</option>)}</select></div>
          <div><Label htmlFor="setup-drive-title">Drive title</Label><input id="setup-drive-title" required maxLength={180} name="title" placeholder="2027 Graduate Hiring" className={fieldClass}/></div>
          <div><Label htmlFor="setup-drive-year">Hiring year</Label><input id="setup-drive-year" required name="hiring_year" type="number" min={2000} max={2100} placeholder="2027" className={fieldClass}/></div>
          <div><Label htmlFor="setup-drive-notes">Supporting notes</Label><textarea id="setup-drive-notes" name="notes" maxLength={5000} placeholder="Explain the source and which candidates it applies to" rows={3} className={fieldClass}/></div>
          <button disabled={drivePending} className={buttonClass}>{drivePending?"Saving drive…":"Create hiring drive"}</button><Feedback state={driveState}/>
        </form>
      </Panel>
      <Panel number={3} title="Add a selection round" description="Add the source link and leave unsupported details unspecified.">
        <form action={roundAction} className="space-y-3">
          <div><Label htmlFor="setup-round-drive">Hiring drive</Label><select id="setup-round-drive" name="drive_id" required className={fieldClass}><option value="">Choose drive</option>{drives.map(drive=><option key={drive.id} value={drive.id}>{drive.name}</option>)}</select></div>
          <div><Label htmlFor="setup-round-number">Round number</Label><input id="setup-round-number" required name="round_number" type="number" min={1} max={30} placeholder="1" className={fieldClass}/></div>
          <div><Label htmlFor="setup-round-name">Round name</Label><input id="setup-round-name" required maxLength={150} name="name" placeholder="Online assessment" className={fieldClass}/></div>
          <div><Label htmlFor="setup-round-description">Round description</Label><textarea id="setup-round-description" name="description" maxLength={5000} rows={3} placeholder="Section and test-pattern details from source" className={fieldClass}/></div>
          <div><Label htmlFor="setup-round-source">Evidence URL</Label><input id="setup-round-source" required name="source_url" type="url" placeholder="https://official-site.example/notice" className={fieldClass}/></div>
          <button disabled={roundPending} className={buttonClass}>{roundPending?"Saving round…":"Add selection round"}</button><Feedback state={roundState}/>
        </form>
      </Panel>
      <Panel number={4} title="Register a monitoring source" description="Choose a company, then its role and drive for precise update detection.">
        <form action={sourceAction} className="space-y-3">
          <div><Label htmlFor="source-company">Company</Label><select id="source-company" name="company_id" required value={sourceCompany} onChange={e=>{setSourceCompany(e.target.value);setSourceRole("");setSourceDrive("");}} className={fieldClass}><option value="">Choose company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><Label htmlFor="source-role">Role scope</Label><select id="source-role" name="role_id" value={sourceRole} disabled={!sourceCompany} onChange={e=>{setSourceRole(e.target.value);setSourceDrive("");}} className={fieldClass}><option value="">Entire company (new roles and drives)</option>{matchingRoles.map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
          <div><Label htmlFor="source-drive">Drive scope</Label><select id="source-drive" name="drive_id" value={sourceDrive} disabled={!sourceRole} onChange={e=>setSourceDrive(e.target.value)} className={fieldClass}><option value="">All drives (new hiring drives)</option>{matchingDrives.map(drive=><option key={drive.id} value={drive.id}>{drive.name}</option>)}</select></div>
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs leading-5"><p className="inline-flex items-center gap-1.5 font-semibold"><CheckCircle2 size={14} aria-hidden/> Monitoring scope</p><p className="mt-1 text-[var(--color-ink)]/70" aria-live="polite">{sourceScope}</p></div>
          <div><Label htmlFor="source-frequency">Check frequency</Label><select id="source-frequency" name="poll_interval_minutes" defaultValue="360" className={fieldClass}><option value="60">Every hour</option><option value="180">Every 3 hours</option><option value="360">Every 6 hours (recommended)</option><option value="720">Every 12 hours</option><option value="1440">Daily</option></select><p className="mt-1 text-xs text-[var(--color-ink)]/55">The monitor backs off after failures to avoid stressing official sources.</p></div>
          <div><Label htmlFor="source-label">Source label</Label><input id="source-label" required maxLength={140} name="label" placeholder="Official graduate hiring announcement" className={fieldClass}/></div>
          <div><Label htmlFor="source-url">Official source URL</Label><input id="source-url" required name="source_url" type="url" placeholder="https://careers.company.example/jobs" className={fieldClass}/></div>
          <p className="flex items-start gap-2 text-xs leading-5 text-amber-800"><ShieldAlert size={17} className="shrink-0" aria-hidden/> Register only authorized HTTPS endpoints. The server must also list the exact hostname in RECRUITMENT_ALLOWED_HOSTS. Private, login-only and CAPTCHA-protected sites cannot be scanned by this adapter.</p>
          <button disabled={sourcePending} className={buttonClass}><Link2 size={16} aria-hidden className="mr-2"/>{sourcePending?"Adding source…":"Register monitored source"}</button><Feedback state={sourceState}/>
        </form>
      </Panel>
    </div>
    <p className="inline-flex items-center gap-2 text-xs leading-5 text-[var(--color-ink)]/65"><ArrowUpRight size={15} aria-hidden/> Review the original recruiter notice before approving a suggested change. AI extraction is not independent verification.</p>
  </div>;
}
