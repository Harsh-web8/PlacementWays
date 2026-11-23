import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth/session";
import { RecruitmentSetupForms } from "@/components/admin/recruitment-forms";
import { WatchSourceDashboard } from "@/components/admin/watch-source-dashboard";
import { RecruitmentChangeEditor } from "@/components/admin/recruitment-change-editor";
import { decideRecruitmentProposal, rollbackRecruitmentProposal, scanSourcesNow, decideRecruitmentDiscovery, rollbackRecruitmentDiscovery } from "@/server/recruitment/actions";

export const metadata = { title: "Recruitment intelligence", robots: { index: false, follow: false } };
type Target={kind:"role"|"drive"|"round"|"round_new";id:string;label:string};
const stringify=(value:unknown)=> value===null||value===undefined?"Not specified":typeof value==="string"?value:JSON.stringify(value,null,2);

export default async function RecruitmentAdmin() {
  await requireAdmin();
  const db=(await createClient()) as unknown as SupabaseClient;
  const [companies,roles,drives,rounds,sources,proposals,approved,discoveries,recentDiscoveries]=await Promise.all([
    db.from("companies").select("id,name").order("name"),
    db.from("company_roles").select("id,title,company_id").order("title"),
    db.from("recruitment_drives").select("id,title,role_id").order("created_at",{ascending:false}),
    db.from("recruitment_rounds").select("id,name,round_number,drive_id").order("round_number"),
    db.from("recruitment_watch_sources").select("id,label,source_url,last_checked_at,last_success_at,last_error,enabled,company_id,role_id,drive_id,next_check_at,consecutive_failures,poll_interval_minutes").order("created_at",{ascending:false}),
    db.from("recruitment_change_proposals").select("id,headline,summary,evidence,previous_excerpt,source_url,confidence,classification,detected_at,extraction_status,role_id,drive_id,company_id").eq("status","pending").order("detected_at",{ascending:false}).limit(100),
    db.from("recruitment_updates").select("id,proposal_id,headline,published_at,is_current,structured_change_count").order("published_at",{ascending:false}).limit(20),
    db.from("recruitment_discovery_candidates").select("id,kind,company_id,role_title,payload,evidence_quote,created_at,recruitment_change_proposals(source_url,headline)").eq("status","pending").order("created_at",{ascending:false}).limit(80),
    db.from("recruitment_discovery_candidates").select("id,kind,role_title,status,reviewed_at,created_role_id,created_drive_id").in("status",["approved","rejected","rolled_back"]).order("reviewed_at",{ascending:false}).limit(30),
  ]);
  const ids=(proposals.data??[]).map(p=>p.id);
  const {data:fields,error:fieldError}=ids.length?await db.from("recruitment_field_changes")
    .select("id,proposal_id,target_kind,target_id,field_key,old_value,new_value,evidence_quote").in("proposal_id",ids)
    .order("created_at"): {data:[],error:null};
  const missingMigration=roles.error||drives.error||sources.error||proposals.error||approved.error||discoveries.error||recentDiscoveries.error||fieldError;
  return <div className="space-y-10">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--color-accent)]">Private admin dashboard</p><h1 className="mt-2 font-serif text-4xl">Recruitment intelligence</h1><p className="mt-2 text-sm text-[var(--color-ink)]/70">Review verified evidence and field-level changes. No unapproved change is made public.</p></div>
      <form action={scanSourcesNow}><button className="rounded-lg bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold text-white">Scan next 3 due sources now</button></form></header>
    <nav aria-label="Recruitment admin sections" className="flex flex-wrap gap-2 text-sm">
      {[{href:"#discoveries",label:`New roles & drives (${discoveries.data?.length??0})`},{href:"#approvals",label:`Pending approvals (${proposals.data?.length??0})`},{href:"/admin/recruitment/coverage",label:"Coverage & quality"},{href:"#sources",label:`Source health (${sources.data?.length??0})`},{href:"#setup",label:"Add company role or source"},{href:"#history",label:"Publication history"}].map(link=><a key={link.href} href={link.href} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 font-medium hover:border-[var(--color-ink)]/50">{link.label}</a>)}
    </nav>
    {missingMigration&&<p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Some recruitment tables are missing or inaccessible. Apply all recruitment SQL migrations through Milestone 4 before using the approval system.</p>}
    <section id="discoveries" className="scroll-mt-28 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-2xl">New roles and hiring drives</h2><p className="mt-1 text-sm text-[var(--color-ink)]/65">AI-detected entity creation is always separate from news publishing. Review exact source evidence before approving.</p></div><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">{discoveries.data?.length??0} awaiting review</span></div>
      {!discoveries.data?.length?<p className="rounded-xl border border-dashed p-6 text-sm">No newly discovered roles or drives are waiting. A first successful source scan can propose source-supported discoveries when AI extraction is configured.</p>:<div className="grid gap-4 lg:grid-cols-2">{discoveries.data.map(candidate=>{
        const linked=candidate.recruitment_change_proposals as unknown as {source_url?:string;headline?:string}|null;
        return <article key={candidate.id} className="space-y-3 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-900">New {candidate.kind}</span><span className="text-[var(--color-ink)]/60">{new Date(candidate.created_at).toLocaleString("en-IN")}</span></div>
          <h3 className="font-serif text-xl">{candidate.kind==="role"?(candidate.payload as {role?:{title?:string}})?.role?.title:candidate.role_title}</h3>
          <p className="text-xs text-[var(--color-ink)]/70">Company: {(companies.data??[]).find(co=>co.id===candidate.company_id)?.name??"Unknown"}</p>
          <p className="text-xs font-semibold">{linked?.headline??"Source-derived discovery"}</p>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--color-paper)] p-3 text-xs">{JSON.stringify(candidate.payload,null,2)}</pre>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs"><strong>Quoted evidence (check each proposed field against the source)</strong><p className="mt-1 break-words">{candidate.evidence_quote}</p></div>
          {linked?.source_url&&<a href={linked.source_url} target="_blank" rel="noopener noreferrer" className="inline-block break-all text-xs underline">Open original recruitment notice</a>}
          <p className="text-xs text-[var(--color-ink)]/60">Approval creates published guides. Duplicates are rejected by the database. No AI content is automatically published.</p>
          <div className="flex flex-wrap gap-2"><form action={decideRecruitmentDiscovery.bind(null,candidate.id,true)}><button className="rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white">Approve & publish guide</button></form><form action={decideRecruitmentDiscovery.bind(null,candidate.id,false)}><button className="rounded-lg border px-4 py-2 text-xs font-semibold">Reject</button></form></div>
        </article>;
      })}</div>}
      {!!recentDiscoveries.data?.length&&<details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">Recent discovery decisions ({recentDiscoveries.data.length})</summary><div className="mt-3 space-y-3">{recentDiscoveries.data.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs"><div><strong>{item.role_title}</strong> · {item.kind} · {item.status}{item.reviewed_at?` · ${new Date(item.reviewed_at).toLocaleDateString("en-IN")}`:""}</div>{item.status==="approved"&&<form action={rollbackRecruitmentDiscovery.bind(null,item.id)}><button className="rounded border border-red-300 px-3 py-2 text-red-800">Rollback if untouched</button></form>}</div>)}</div></details>}
    </section>
    <section id="approvals" className="scroll-mt-28"><div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-2xl">Awaiting your approval</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium">{proposals.data?.length??0} pending</span></div>
      {(proposals.data?.length??0)===0 ? <p className="rounded-xl border border-dashed p-6 text-sm">No changes pending. Register official sources below. The first scan establishes a baseline; later differences enter this queue.</p> : <div className="space-y-5">{proposals.data?.map(p=>{
        const patches=(fields??[]).filter(f=>f.proposal_id===p.id);
        const targets:Target[]=[];
        const role=(roles.data??[]).find(r=>r.id===p.role_id&&r.company_id===p.company_id);
        const drive=(drives.data??[]).find(d=>d.id===p.drive_id&&d.role_id===p.role_id);
        if(role)targets.push({kind:"role",id:role.id,label:`Role: ${role.title}`});
        if(drive){
          targets.push({kind:"drive",id:drive.id,label:`Hiring drive: ${drive.title}`});
          for(const round of (rounds.data??[]).filter(r=>r.drive_id===drive.id))
            targets.push({kind:"round",id:round.id,label:`Round ${round.round_number}: ${round.name}`});
          targets.push({kind:"round_new",id:drive.id,label:"Create new selection round"});
        }
        return <article key={p.id} className="rounded-xl border bg-white p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink)]/65"><span className="rounded bg-[var(--color-paper)] px-2 py-1">{p.classification.replaceAll("_"," ")}</span><span>{p.confidence}</span><span>· {new Date(p.detected_at).toLocaleString("en-IN")}</span><span>· Extraction: {p.extraction_status.replaceAll("_"," ")}</span></div>
          <h3 className="mt-3 font-serif text-xl">{p.headline}</h3><p className="mt-3 whitespace-pre-line text-sm leading-6">{p.summary}</p>
          <div className="mt-4 rounded-lg bg-[var(--color-paper)] p-4 text-xs"><strong>Source evidence</strong><p className="mt-2 break-words">{p.evidence}</p></div>
          {p.previous_excerpt&&<details className="mt-3 rounded-lg border p-3 text-xs"><summary className="cursor-pointer font-semibold">Previous source snapshot</summary><p className="mt-2 break-words">{p.previous_excerpt.slice(0,2000)}</p></details>}
          <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm underline">Open the original source</a>
          <div className="mt-5 space-y-3"><h4 className="font-semibold">Proposed structured changes ({patches.length})</h4>
            {patches.length===0?<p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs">No machine-extracted changes were validated. Approval will publish a source-linked announcement only. You can add supported field changes below after checking the source.</p>:patches.map(f=><div key={f.id} className="rounded-lg border bg-white p-4 text-sm">
              <p className="font-semibold">{f.target_kind.replace("_"," ")} · {f.field_key.replaceAll("_"," ")}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-xs font-semibold text-red-700">Current</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-red-50 p-2 text-xs">{stringify(f.old_value)}</pre></div><div><p className="mb-1 text-xs font-semibold text-green-700">Proposed</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-green-50 p-2 text-xs">{stringify(f.new_value)}</pre></div></div>
              <p className="mt-3 text-xs text-[var(--color-ink)]/65"><strong>Evidence:</strong> {f.evidence_quote}</p>
            </div>)}
          </div>
          <RecruitmentChangeEditor proposalId={p.id} evidence={p.evidence} targets={targets}/>
          <p className="mt-4 text-xs text-amber-900">Before approving, inspect the original notice. AI suggestions are not independent verification. All structured fields above will be applied in one database transaction.</p>
          <div className="mt-4 flex flex-wrap gap-3"><form action={decideRecruitmentProposal.bind(null,p.id,true)}><button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">Approve changes &amp; publish</button></form><form action={decideRecruitmentProposal.bind(null,p.id,false)}><button className="rounded-lg border px-4 py-2 text-sm font-semibold">Reject proposal</button></form></div>
        </article>;
      })}</div>}
    </section>
    <section id="history" className="scroll-mt-28"><h2 className="mb-4 font-serif text-2xl">Recent publication history</h2><p className="mb-3 text-sm text-[var(--color-ink)]/65">Rollback restores tracked fields only if nobody has modified them since approval. It also retracts the public update.</p>
      <div className="space-y-2">{(approved.data??[]).map(u=><div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 text-sm"><div><p className="font-semibold">{u.headline}</p><p className="mt-1 text-xs text-[var(--color-ink)]/60">{u.structured_change_count} field changes · {new Date(u.published_at).toLocaleString("en-IN")} · {u.is_current?"Published":"Rolled back"}</p></div>{u.is_current&&<form action={rollbackRecruitmentProposal.bind(null,u.proposal_id)}><button className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-800">Rollback publication</button></form>}</div>)}</div>
    </section>
    <section id="sources" className="scroll-mt-28 space-y-5"><div><h2 className="font-serif text-2xl">Monitored recruitment sources</h2><p className="mt-2 text-sm text-[var(--color-ink)]/65">Review registered sources, check errors and see whether a baseline has been captured.</p></div><WatchSourceDashboard sources={sources.data??[]} companies={(companies.data??[]).map(c=>({id:c.id,name:c.name}))} roles={(roles.data??[]).map(r=>({id:r.id,name:r.title,companyId:r.company_id}))} drives={(drives.data??[]).map(d=>({id:d.id,name:d.title,roleId:d.role_id}))}/></section>
    <section id="setup" className="scroll-mt-28 space-y-4"><h2 className="font-serif text-2xl">Manage recruitment guides and sources</h2><p className="text-sm text-[var(--color-ink)]/65">Attach a source to a specific hiring drive to enable automatic suggestions for selection rounds, test patterns and deadlines. Only source-supported information should be published.</p>
      <RecruitmentSetupForms companies={(companies.data??[]).map(c=>({id:c.id,name:c.name}))} roles={(roles.data??[]).map(r=>({id:r.id,name:r.title,companyId:r.company_id}))} drives={(drives.data??[]).map(d=>({id:d.id,name:d.title,roleId:d.role_id}))}/>
    </section>
  </div>;
}
