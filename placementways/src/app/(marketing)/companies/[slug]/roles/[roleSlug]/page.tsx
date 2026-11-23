import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2,
  ChevronRight, Clock3, Code2, FileQuestion, GraduationCap, HelpCircle, ShieldCheck,
} from "lucide-react";
import { publicMetadata } from "@/lib/seo";
import { assessReviewDate, assessDriveLabel } from "@/lib/recruitment-quality";
import { getPublishedCompany } from "@/server/companies/queries";
import { getRoleGuide, listRecruitmentUpdates, type RecruitmentDrive } from "@/server/recruitment/queries";

const formatDate = (date: string | null | undefined) => date && !Number.isNaN(Date.parse(date))
  ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
const statusClasses: Record<string,string> = {
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
  open: "border-green-200 bg-green-50 text-green-800",
  upcoming: "border-blue-200 bg-blue-50 text-blue-800",
  closed: "border-slate-200 bg-slate-50 text-slate-700",
  completed: "border-slate-200 bg-slate-50 text-slate-700",
  cancelled: "border-red-200 bg-red-50 text-red-800",
};
function DriveStatus({drive}:{drive:RecruitmentDrive}) {
  const status=assessDriveLabel(drive.drive_status,drive.closes_at);
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status.warning?"border-amber-200 bg-amber-50 text-amber-900":statusClasses[drive.drive_status] ?? "border-slate-200 bg-slate-50"}`}>{status.label}</span>;
}
function GuideSection({title,children,id}:{title:string;children:React.ReactNode;id?:string}) {
  return <section id={id} className="scroll-mt-28 rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm md:p-8"><h2 className="font-serif text-2xl md:text-3xl">{title}</h2><div className="mt-5">{children}</div></section>;
}
export default async function RoleGuide({ params }: { params: Promise<{ slug: string; roleSlug: string }> }) {
  const { slug, roleSlug } = await params;
  const company = await getPublishedCompany(slug);
  if (!company) notFound();
  const guide = await getRoleGuide(company.id, roleSlug);
  if (!guide) notFound();
  const { role, drives } = guide;
  const updates = await listRecruitmentUpdates(company.id, role.id);
  const roundsCount = drives.reduce((sum, drive) => sum + drive.rounds.length, 0);
  const roleReview = assessReviewDate(role.last_verified_at);
  return <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink)]/65">
      <Link href="/companies" className="hover:underline">Companies</Link><ChevronRight size={14} aria-hidden/>
      <Link href={`/companies/${slug}`} className="hover:underline">{company.name}</Link><ChevronRight size={14} aria-hidden/>
      <span aria-current="page" className="font-medium text-[var(--color-ink)]">{role.title}</span>
    </nav>
    <header className="mt-7 overflow-hidden rounded-3xl bg-[var(--color-ink)] p-7 text-white sm:p-10 lg:p-12">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/65"><BriefcaseBusiness size={16} aria-hidden/> {company.name} <span aria-hidden>·</span> Role preparation</div>
      <h1 className="mt-4 max-w-4xl font-serif text-4xl leading-tight sm:text-5xl">{role.title}</h1>
      <p className="mt-5 max-w-3xl leading-7 text-white/80">{role.description || "Explore drive-specific recruitment rounds and verified requirements. Details are added only when supported by sources."}</p>
      <div className="mt-7 flex flex-wrap gap-3"><Link href={`/tests?company=${slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)]"><BookOpen size={16} aria-hidden/> Free mock tests</Link><Link href="/coding" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"><Code2 size={16} aria-hidden/> Coding practice</Link></div>
    </header>
    <div className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${roleReview.state === "recent" && role.source_url ? "border-blue-200 bg-blue-50 text-blue-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
      <p className="font-semibold">Evidence and freshness · {roleReview.label}</p>
      <p className="mt-1">{!role.source_url ? "No supporting source URL is recorded for this role. " : ""}Recruitment eligibility and test patterns may change without notice. Confirm important details on the employer’s latest official announcement.</p>
      {role.source_url&&<a href={role.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline underline-offset-4">Review recorded source <ArrowUpRight size={14} className="inline"/></a>}
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[{label:"Published hiring drives",value:drives.length,icon:CalendarDays},{label:"Documented selection rounds",value:roundsCount,icon:CheckCircle2},{label:"Reviewed role updates",value:updates.length,icon:ShieldCheck}].map(stat=><div key={stat.label} className="rounded-xl border border-[var(--color-line)] bg-white p-4"><stat.icon size={18} className="text-[var(--color-success)]" aria-hidden/><p className="mt-3 text-2xl font-semibold tabular-nums">{stat.value}</p><p className="mt-1 text-xs text-[var(--color-ink)]/65">{stat.label}</p></div>)}
    </div>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-7">
        <GuideSection id="eligibility" title="Eligibility & responsibilities">
          <div className="flex items-start gap-3"><GraduationCap size={21} className="mt-1 shrink-0 text-[var(--color-success)]" aria-hidden/><div className="min-w-0"><h3 className="font-semibold">Eligibility requirements</h3><p className="mt-2 whitespace-pre-line leading-7 text-[var(--color-ink)]/80">{role.eligibility || "Eligibility has not been officially verified for this role. Confirm directly with the employer."}</p></div></div>
          {role.source_url && <p className="mt-4 text-sm"><a href={role.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">Recruitment source <ArrowUpRight size={14}/></a>{role.last_verified_at && <span className="ml-2 text-xs text-[var(--color-ink)]/60">Admin reviewed {formatDate(role.last_verified_at)}</span>}</p>}
          {role.responsibilities && <div className="mt-6 border-t border-[var(--color-line)] pt-5"><h3 className="font-semibold">Role responsibilities</h3><p className="mt-2 whitespace-pre-line leading-7 text-[var(--color-ink)]/80">{role.responsibilities}</p></div>}
        </GuideSection>
        <GuideSection id="salary" title="Salary & required skills">
          <p className="whitespace-pre-line leading-7 text-[var(--color-ink)]/80">{role.salary_details || "No verified compensation information is currently published."}</p>
          <h3 className="mt-6 font-semibold">Skills mentioned for this role</h3>
          {role.required_skills?.length ? <ul className="mt-3 flex flex-wrap gap-2">{role.required_skills.map(skill=><li key={skill} className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm">{skill}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--color-ink)]/65">Skills have not been confirmed by a supporting source.</p>}
        </GuideSection>
        <section id="drives" className="scroll-mt-28 space-y-5"><div><h2 className="font-serif text-3xl">Recruitment drives & test patterns</h2><p className="mt-2 text-sm leading-6 text-[var(--color-ink)]/65">Each drive has its own selection process. Question counts and timings are omitted if not supported by evidence.</p></div>
          {drives.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-white p-8"><HelpCircle size={24} aria-hidden/><h3 className="mt-3 font-semibold">No drive-specific pattern published yet</h3><p className="mt-2 text-sm leading-6 text-[var(--color-ink)]/65">Check the employer’s official site for the current requirements.</p></div> : drives.map(drive=><article id={`drive-${drive.id}`} key={drive.id} className="scroll-mt-28 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-sm">
            <div className="border-b border-[var(--color-line)] bg-[var(--color-paper)]/60 p-6 md:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><DriveStatus drive={drive}/>{drive.hiring_year&&<span className="text-xs text-[var(--color-ink)]/65">Hiring year {drive.hiring_year}</span>}</div><h3 className="mt-3 font-serif text-2xl md:text-3xl">{drive.title}</h3>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink)]/65"><span className={`inline-flex items-center gap-1 ${assessReviewDate(drive.last_verified_at).state!=="recent"?"font-semibold text-amber-800":""}`}><ShieldCheck size={14} aria-hidden/> {assessReviewDate(drive.last_verified_at).label}</span>{drive.closes_at&&<span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden/> Deadline listed: {formatDate(drive.closes_at)}</span>}</div>
              {drive.source_url&&<a href={drive.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs underline underline-offset-4">Recruitment notice <ArrowUpRight size={14}/></a>}
              {drive.application_url&&<a href={drive.application_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-semibold hover:border-[var(--color-ink)]/50">View application source <ArrowUpRight size={16}/></a>}
            </div>
            <div className="p-6 md:p-8">{drive.notes&&<p className="mb-6 whitespace-pre-line text-sm leading-7 text-[var(--color-ink)]/75">{drive.notes}</p>}
              <h4 className="text-lg font-semibold">Selection rounds</h4>
              {drive.rounds.length===0?<p className="mt-3 text-sm text-[var(--color-ink)]/65">No round-level details have been verified for this drive yet.</p>:<ol className="mt-5 space-y-4">{drive.rounds.map(round=><li key={round.id} className="rounded-xl border border-[var(--color-line)] p-5">
                <div className="flex flex-wrap items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-sm font-semibold text-white">{round.round_number}</span><h5 className="text-lg font-semibold">{round.name}</h5><span className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 text-xs capitalize">{round.source_kind.replaceAll("_"," ")}</span></div>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--color-ink)]/75">{round.description || "The employer has not supplied a verified description of this stage."}</p>
                {(round.question_count!==null||round.duration_minutes!==null)&&<div className="mt-4 flex flex-wrap gap-3 text-sm">{round.question_count!==null&&<span className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-paper)] px-3 py-2"><FileQuestion size={16} aria-hidden/>{round.question_count} questions</span>}{round.duration_minutes!==null&&<span className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-paper)] px-3 py-2"><Clock3 size={16} aria-hidden/>{round.duration_minutes} min</span>}</div>}
                {round.marking_rules&&<p className="mt-4 text-sm"><strong>Marking and rules:</strong> {round.marking_rules}</p>}
                {round.topics?.length>0&&<div className="mt-4"><p className="text-sm font-semibold">Syllabus topics</p><ul className="mt-2 flex flex-wrap gap-2">{round.topics.map(topic=><li key={topic} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs">{topic}</li>)}</ul></div>}
                {round.source_url&&<a href={round.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">View evidence <ArrowUpRight size={14}/></a>}
              </li>)}</ol>}
            </div>
          </article>)}
        </section>
        <GuideSection id="updates" title="Approved recruitment updates">
          {updates.length?<ol className="space-y-4">{updates.map(update=><li key={update.id} className="border-b border-[var(--color-line)] pb-4 last:border-b-0 last:pb-0"><p className="text-xs text-[var(--color-ink)]/60">Reviewed {formatDate(update.published_at)}</p><h3 className="mt-2 font-semibold">{update.headline}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6">{update.summary}</p><a href={update.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm underline">Original source <ArrowUpRight size={14}/></a></li>)}</ol>:<p className="text-sm leading-6 text-[var(--color-ink)]/70">No approved announcements for this role yet. Information is added as monitored sources are reviewed.</p>}
        </GuideSection>
        <Link href={`/companies/${slug}`} className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"><ArrowLeft size={16}/> Back to {company.name}</Link>
      </div>
      <aside className="hidden lg:block"><nav aria-label="Sections on this page" className="sticky top-24 space-y-5 rounded-2xl border border-[var(--color-line)] bg-white p-5 text-sm shadow-sm"><h2 className="font-semibold">On this page</h2><ul className="space-y-3"><li><a href="#eligibility" className="hover:underline">Eligibility</a></li><li><a href="#salary" className="hover:underline">Salary and skills</a></li><li><a href="#drives" className="hover:underline">Hiring drives and rounds</a></li>{drives.slice(0,5).map(drive=><li key={drive.id} className="pl-3 text-xs"><a href={`#drive-${drive.id}`} className="hover:underline">{drive.title}</a></li>)}<li><a href="#updates" className="hover:underline">Reviewed announcements</a></li></ul><div className="border-t border-[var(--color-line)] pt-4"><p className="text-xs leading-6 text-[var(--color-ink)]/65">Information may change between hiring cycles. Verify critical dates and criteria with the official employer.</p></div></nav></aside>
    </div>
  </div>;
}

export async function generateMetadata({params}:{params:Promise<{slug:string;roleSlug:string}>}):Promise<Metadata> {
  const {slug,roleSlug}=await params;
  const company=await getPublishedCompany(slug);
  const guide=company?await getRoleGuide(company.id,roleSlug):null;
  return publicMetadata(guide?`${company!.name} ${guide.role.title} hiring process`:"Recruitment role guide",
    guide?.role.description||"Role-specific eligibility, test patterns and recruitment rounds, with verification status.",
    `/companies/${slug}/roles/${roleSlug}`);
}
