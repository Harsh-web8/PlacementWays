"use client";

import { useState } from "react";
import { retryRecruitmentSource, setRecruitmentSourceEnabled } from "@/server/recruitment/actions";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Search, Shield } from "lucide-react";

type WatchSource = {
  id: string; label: string; source_url: string; company_id: string; role_id: string | null;
  drive_id: string | null; last_checked_at: string | null; last_success_at: string | null; next_check_at: string | null; poll_interval_minutes: number; consecutive_failures: number; last_error: string | null; enabled: boolean;
};
type ScopeName = {id:string;name:string};
type RoleName = ScopeName & { companyId: string };
type DriveName = ScopeName & { roleId: string };
type Filter = "all" | "errors" | "unchecked" | "disabled";
const filters: {id:Filter;label:string}[] = [
  {id:"all",label:"All sources"},{id:"errors",label:"Errors"},
  {id:"unchecked",label:"Awaiting first check"},{id:"disabled",label:"Disabled"},
];
export function WatchSourceDashboard({sources,companies,roles,drives}:{sources:WatchSource[];companies:ScopeName[];roles:RoleName[];drives:DriveName[]}) {
  const [filter,setFilter]=useState<Filter>("all");
  const [query,setQuery]=useState("");
  const names=new Map(companies.map(c=>[c.id,c.name]));
  const roleNames=new Map(roles.map(r=>[r.id,r.name]));
  const driveNames=new Map(drives.map(d=>[d.id,d.name]));
  const visible=sources.filter(source=>{
    if(filter==="errors" && !(source.enabled && source.last_error))return false;
    if(filter==="unchecked" && !(source.enabled && !source.last_checked_at))return false;
    if(filter==="disabled" && source.enabled)return false;
    const text=[source.label,source.source_url,names.get(source.company_id),source.role_id?roleNames.get(source.role_id):"",source.drive_id?driveNames.get(source.drive_id):""].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const errors=sources.filter(s=>s.enabled&&s.last_error).length;
  const unchecked=sources.filter(s=>s.enabled&&!s.last_checked_at).length;
  return <div className="space-y-5">
    <div className="grid grid-cols-3 gap-3">{[{label:"Registered",value:sources.length,icon:Shield},{label:"Errors",value:errors,icon:AlertTriangle},{label:"Not checked",value:unchecked,icon:Clock3}].map(stat=><div key={stat.label} className="rounded-xl border border-[var(--color-line)] bg-white p-4"><stat.icon size={17} aria-hidden className="text-[var(--color-ink)]/65"/><p className="mt-3 text-2xl font-semibold tabular-nums">{stat.value}</p><p className="mt-1 text-xs text-[var(--color-ink)]/65">{stat.label}</p></div>)}</div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div className="flex flex-wrap gap-2" role="group" aria-label="Filter monitored sources">{filters.map(f=><button type="button" key={f.id} aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${filter===f.id?"border-[var(--color-ink)] bg-[var(--color-ink)] text-white":"border-[var(--color-line)] bg-white"}`}>{f.label}</button>)}</div><div className="relative"><label htmlFor="monitor-search" className="sr-only">Search registered sources</label><Search aria-hidden size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink)]/50"/><input id="monitor-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search source or company" className="h-10 w-full rounded-lg border border-[var(--color-line)] bg-white pl-10 pr-3 text-sm sm:w-64"/></div></div>
    <p role="status" aria-live="polite" className="text-xs text-[var(--color-ink)]/65">Showing {visible.length} of {sources.length} registered sources</p>
    {visible.length? <div className="grid gap-3 lg:grid-cols-2">{visible.map(source=><article key={source.id} className="rounded-xl border border-[var(--color-line)] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 flex-1 font-semibold">{source.label}</h3><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${!source.enabled?"bg-slate-100 text-slate-700":source.last_error?"bg-amber-100 text-amber-900":source.last_checked_at?"bg-green-100 text-green-800":"bg-blue-100 text-blue-800"}`}>{!source.enabled?"Disabled":source.last_error?"Check failed":source.last_checked_at?"Checked":"Awaiting baseline"}</span></div><p className="mt-2 text-sm text-[var(--color-ink)]/75">{names.get(source.company_id)||"Unknown company"}{source.role_id?` · ${roleNames.get(source.role_id) || "Unknown role"}`:" · All roles"}{source.drive_id?` · ${driveNames.get(source.drive_id)||"Unknown drive"}`:""}</p>
      <p className="mt-2 text-xs text-[var(--color-ink)]/60">{source.drive_id?"Drive-level structured proposals":source.role_id?"Role-level new drive discovery":"Company-wide new role/drive discovery"}</p><a target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 break-all text-xs text-[var(--color-ink)] underline underline-offset-4" href={source.source_url}>{source.source_url}<ExternalLink size={13} className="shrink-0" aria-hidden/></a><p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-ink)]/65">{source.last_checked_at?<><CheckCircle2 size={14} aria-hidden/> Last checked {new Date(source.last_checked_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})}</>:<>Not scanned yet; first scan creates a baseline</>}</p><div className="mt-3 space-y-1 text-xs text-[var(--color-ink)]/65"><p>Frequency: every {source.poll_interval_minutes??360} minutes · Consecutive failures: {source.consecutive_failures??0}</p><p>Next scheduled check: {source.next_check_at?new Date(source.next_check_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"}):"Not scheduled"}</p></div><div className="mt-3 flex flex-wrap gap-2"><form action={setRecruitmentSourceEnabled.bind(null,source.id,!source.enabled)}><button className="rounded border px-3 py-1.5 text-xs font-semibold">{source.enabled?"Disable":"Enable"} monitoring</button></form>{source.enabled&&<form action={retryRecruitmentSource.bind(null,source.id)}><button className="rounded border px-3 py-1.5 text-xs font-semibold">Queue next check</button></form>}</div>{source.last_error&&<p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">Last error: {source.last_error}</p>}</article>)}</div> : <p className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-8 text-sm text-[var(--color-ink)]/70">No matching sources. Try another filter or register an official source below.</p>}
  </div>;
}
