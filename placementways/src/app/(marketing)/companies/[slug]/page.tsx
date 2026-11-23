import { listPublicRoles, listRecruitmentUpdates } from "@/server/recruitment/queries";
import { publicMetadata } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Clock,
  ExternalLink,
  FileQuestion,
  GraduationCap,
  Layers,
} from "lucide-react";
import { getPublishedCompany } from "@/server/companies/queries";

const paragraphs = (text: string | null | undefined) =>
  (text ?? "")
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean);

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white">
      {icon}
      {children}
    </span>
  );
}

export default async function CompanyPage({
  params,
}: PageProps<"/companies/[slug]">) {
  const company = await getPublishedCompany((await params).slug);
  if (!company) notFound();

  const [roles, reviewedUpdates] = await Promise.all([listPublicRoles(company.id), listRecruitmentUpdates(company.id)]);
  const processes = company.processes.map((p) => ({
    ...p,
    stages: [...p.process_stages].sort((a, b) => a.stage_order - b.stage_order),
    sources: [...p.process_sources].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const latest = processes[0];
  const intro = paragraphs(company.description);

  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--color-ink)] text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-white/70">
            <Link href="/companies" className="hover:text-white hover:underline">
              Companies
            </Link>{" "}
            / <span className="text-white">{company.name}</span>
          </nav>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] font-serif text-2xl font-semibold text-[var(--color-ink)]"
                >
                  {company.name.trim().charAt(0).toUpperCase()}
                </span>
                <h1 className="font-serif text-3xl leading-tight md:text-5xl">
                  {company.name}
                </h1>
              </div>
              {intro[0] && (
                <p className="mt-5 text-base leading-7 text-white/85 md:text-lg">
                  {intro[0]}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                <Chip icon={<Layers className="h-4 w-4" />}>{roles.length} published role guides</Chip>
                <Chip icon={<BadgeCheck className="h-4 w-4" />}>{reviewedUpdates.length} approved updates</Chip>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-64">
              <Link
                href={`/tests?company=${company.slug}`}
                className="inline-flex h-12 items-center justify-center rounded-md bg-[var(--color-accent)] px-6 font-medium text-[var(--color-ink)] hover:opacity-90"
              >
                Practice {company.name} mocks
              </Link>
              <Link
                href={`/courses?company=${company.id}`}
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/30 px-6 font-medium text-white hover:bg-white/10"
              >
                Browse courses
              </Link>
              {company.website_url && (
                <a
                  href={company.website_url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="inline-flex items-center justify-center gap-1.5 text-sm text-white/80 hover:text-white hover:underline"
                >
                  Official website <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-14">
          <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
            <h2 className="font-serif text-2xl">Recruitment roles</h2>
            <p className="mt-2 text-sm text-[var(--color-ink)]/70">Choose a role to see its drive-specific eligibility, rounds, pattern, syllabus and sources.</p>
            {roles.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{roles.map(r => <Link key={r.id} href={`/companies/${company.slug}/roles/${r.slug}`} className="group rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)]/40 p-5 transition hover:border-[var(--color-ink)]/50 hover:shadow-sm"><p className="font-semibold group-hover:underline decoration-[var(--color-accent)] underline-offset-4">{r.title} →</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-ink)]/65">{r.description || "See published hiring drives, eligibility, syllabus and test rounds for this role."}</p></Link>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm">No role-specific guides are currently published. We will not substitute an older company-wide process as the current pattern.</p>}
          </section>
          {reviewedUpdates.length>0 && <section className="space-y-4"><h2 className="font-serif text-2xl">Reviewed recruitment updates</h2>{reviewedUpdates.map(u=><article key={u.id} className="rounded-xl border bg-white p-5"><h3 className="font-semibold">{u.headline}</h3><p className="mt-2 text-sm leading-6">{u.summary}</p><a href={u.source_url} className="mt-2 inline-block text-sm underline" rel="noopener noreferrer" target="_blank">Original source</a></article>)}</section>}
          {!processes.length && (
            <p className="rounded-xl border border-[var(--color-line)] bg-white p-6">
              Verified recruitment details have not been published yet. Check
              the company’s official careers website for current eligibility
              and hiring announcements.
            </p>
          )}

          {processes.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-serif text-2xl">Company-wide process archive</h2><p className="mt-2 text-sm leading-6 text-amber-950">The following guides are organized under the older company-wide format. They may describe different hiring years or roles. Use the role-specific pages above for drive-linked details, and confirm current requirements directly with the employer.</p></div>}

          {processes.map((p, i) => {
            const overview = paragraphs(p.description);
            return (
              <section key={p.id} id={`process-${i}`} className="scroll-mt-24 space-y-8">
                <header>
                  <h2 className="font-serif text-2xl md:text-3xl">{p.title}</h2>
                  <p className="mt-1 text-sm text-[var(--color-ink)]/60">
                    {[p.drive_name, p.hiring_year].filter(Boolean).join(" · ")}
                  </p>
                </header>

                {overview.length > 0 && (
                  <div id={`overview-${i}`} className="scroll-mt-24 space-y-3 leading-7">
                    {overview.map((t, k) => (
                      <p key={k}>{t}</p>
                    ))}
                  </div>
                )}

                {p.eligibility && (
                  <div
                    id={`eligibility-${i}`}
                    className="scroll-mt-24 rounded-xl border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 p-5"
                  >
                    <h3 className="flex items-center gap-2 font-semibold">
                      <GraduationCap className="h-5 w-5" /> Who can apply
                    </h3>
                    <ul className="mt-3 space-y-1.5 leading-6">
                      {p.eligibility
                        .split(/;|\n/)
                        .map((t) => t.trim().replace(/\.$/, ""))
                        .filter(Boolean)
                        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
                        .map((t, k) => (
                          <li key={k} className="flex gap-2">
                            <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--color-success)]" />
                            <span>{t}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {p.stages.length > 0 && (
                  <div id={`pattern-${i}`} className="scroll-mt-24">
                    <h3 className="font-serif text-xl md:text-2xl">Exam pattern</h3>
                    <ol className="mt-5 space-y-4">
                      {p.stages.map((s) => (
                        <li
                          key={s.id}
                          className="flex gap-4 rounded-xl border border-[var(--color-line)] bg-white p-5"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-sm font-semibold text-white">
                            {s.stage_order}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <h4 className="font-semibold">{s.name}</h4>
                              {(s.duration_minutes ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-sm text-[var(--color-ink)]/70">
                                  <Clock className="h-3.5 w-3.5" />
                                  {s.duration_minutes} min
                                </span>
                              )}
                              {(s.question_count ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-sm text-[var(--color-ink)]/70">
                                  <FileQuestion className="h-3.5 w-3.5" />
                                  {s.question_count} questions
                                </span>
                              )}
                            </div>
                            {s.description && (
                              <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]/80">
                                {s.description}
                              </p>
                            )}
                            {s.topics.length > 0 && (
                              <ul className="mt-3 flex flex-wrap gap-1.5">
                                {s.topics.map((t) => (
                                  <li
                                    key={t}
                                    className="rounded-full bg-[var(--color-paper)] px-2.5 py-1 text-xs ring-1 ring-[var(--color-line)]"
                                  >
                                    {t}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div id={`sources-${i}`} className="scroll-mt-24 border-t border-[var(--color-line)] pt-5 text-sm">
                  <p className="text-[var(--color-ink)]/70">
                    Last recorded verification: {p.last_verified_on || "Not recorded"}. This is an archived company-wide guide; hiring requirements may have changed. Confirm against the linked official sources.
                  </p>
                  {p.sources.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                      {p.sources.map((s) => (
                        <li key={s.id}>
                          <a
                            className="inline-flex items-center gap-1 underline"
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {s.label} <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            {latest && (
              <nav aria-label="On this page" className="rounded-xl border border-[var(--color-line)] bg-white p-5 text-sm">
                <p className="font-semibold">Company-wide archive</p>
                <ul className="mt-3 space-y-2">
                  {latest.description && (
                    <li><a className="hover:underline" href="#overview-0">Overview</a></li>
                  )}
                  {latest.eligibility && (
                    <li><a className="hover:underline" href="#eligibility-0">Eligibility</a></li>
                  )}
                  {latest.stages.length > 0 && (
                    <li><a className="hover:underline" href="#pattern-0">Exam pattern</a></li>
                  )}
                  <li><a className="hover:underline" href="#sources-0">Sources</a></li>
                </ul>
              </nav>
            )}
            <div className="rounded-xl bg-[var(--color-ink)] p-5 text-white">
              <p className="font-serif text-lg">Ready to practise?</p>
              <p className="mt-1 text-sm text-white/75">
                Timed mocks with instant scoring and analytics.
              </p>
              <Link
                href={`/tests?company=${company.slug}`}
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--color-accent)] text-sm font-medium text-[var(--color-ink)] hover:opacity-90"
              >
                Start a mock test
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export async function generateMetadata({params}:PageProps<"/companies/[slug]">){const {slug}=await params;const item=await getPublishedCompany(slug);return publicMetadata(item?.name??"Company",item?.description,`/companies/${slug}`);}
