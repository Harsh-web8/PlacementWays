import Link from "next/link";
import { ArrowUpRight, CalendarClock, ShieldCheck } from "lucide-react";
import { listRecruitmentUpdates } from "@/server/recruitment/queries";
import { getPublishedCompanies } from "@/server/companies/queries";

export const metadata = {
  title: "Verified recruitment updates",
  description: "Reviewed recruitment announcements and hiring-process changes, with original source links.",
};

export default async function RecruitmentFeed() {
  const [updates, companies] = await Promise.all([listRecruitmentUpdates(), getPublishedCompanies()]);
  const names = new Map(companies.map(c => [c.id, c]));
  return <div className="mx-auto max-w-6xl px-6 py-12">
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-[var(--color-accent)]">Recruitment intelligence</p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Recruitment updates, with sources.</h1>
      <p className="mt-4 leading-7 text-[var(--color-ink)]/70">Every post on this feed has been approved by an administrator. Always confirm your application details on the linked official source before acting.</p>
    </div>
    {updates.length === 0 ? <div className="mt-10 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-9"><ShieldCheck className="mb-4" /><h2 className="font-semibold">No reviewed updates yet</h2><p className="mt-2 text-sm text-[var(--color-ink)]/70">Updates will appear after source monitoring and editorial approval. Explore verified company guides meanwhile.</p><Link className="mt-5 inline-block underline" href="/companies">Explore companies</Link></div>
    : <div className="mt-9 grid gap-4 md:grid-cols-2">{updates.map(update=><article key={update.id} className="rounded-xl border border-[var(--color-line)] bg-white p-6">
      <div className="flex items-center gap-2 text-xs text-[var(--color-ink)]/60"><CalendarClock size={14}/><time dateTime={update.published_at}>{new Date(update.published_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</time><span>· Admin reviewed</span></div>
      <h2 className="mt-3 font-serif text-xl">{update.headline}</h2><p className="mt-3 whitespace-pre-line text-sm leading-6">{update.summary}</p>
      <div className="mt-5 flex flex-wrap gap-4 text-sm">{names.get(update.company_id) && <Link className="underline" href={`/companies/${names.get(update.company_id)!.slug}`}>Company guide</Link>}
      <a className="inline-flex items-center gap-1 underline" href={update.source_url} target="_blank" rel="noopener noreferrer">Original source <ArrowUpRight size={14}/></a></div>
    </article>)}</div>}
  </div>;
}
