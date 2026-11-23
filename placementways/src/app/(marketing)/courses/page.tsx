import Link from "next/link";
import { z } from "zod";
import { Search } from "lucide-react";
import { listCourses } from "@/server/learning/queries";
import { getPublishedCompanies } from "@/server/companies/queries";
import { CourseCard } from "@/components/learning/course-card";
import { PageHero } from "@/components/marketing/page-hero";
export const metadata = { title: "Courses" };
export default async function Courses({ searchParams }: PageProps<"/courses">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const company = z.uuid().safeParse(sp.company).success
    ? String(sp.company)
    : undefined;
  const page = Math.floor(Math.min(10000, Math.max(1, Number(sp.page) || 1)));
  const [{ courses, total }, companies] = await Promise.all([
    listCourses(company, q, page),
    getPublishedCompanies(),
  ]);
  const lastPage = Math.max(1, Math.ceil(total / 12));
  const pageLink = (n: number) =>
    `?${new URLSearchParams({ q, company: company ?? "", page: String(n) })}`;
  const btn =
    "rounded-md border border-[var(--color-line)] bg-white px-4 py-2 text-sm hover:border-[var(--color-ink)]/50";
  return (
    <div>
      <PageHero
        title="Learn with a clear path"
        subtitle="Build understanding one lesson at a time, then put it into practice."
      >
        <form className="mt-7 flex max-w-2xl flex-wrap gap-2" role="search">
          <label className="sr-only" htmlFor="course-search">Search courses</label>
          <div className="relative min-w-[200px] flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink)]/50" />
            <input
              id="course-search"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Search courses"
              className="h-12 w-full rounded-md bg-white pl-10 pr-3 text-[var(--color-ink)]"
            />
          </div>
          <label className="sr-only" htmlFor="course-company">Company</label>
          <select
            id="course-company"
            name="company"
            defaultValue={company ?? ""}
            className="h-12 rounded-md bg-white px-3 text-[var(--color-ink)]"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="h-12 rounded-md bg-[var(--color-accent)] px-6 font-medium text-[var(--color-ink)] hover:opacity-90">
            Find courses
          </button>
        </form>
      </PageHero>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
        <p className="text-sm text-[var(--color-ink)]/70">
          <strong className="text-[var(--color-ink)]">{total}</strong> course{total === 1 ? "" : "s"}
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
        {!courses.length && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center text-[var(--color-ink)]/70">
            {q || company ? "No courses match your search. Try different words." : "Courses are being added. Check back soon."}
          </p>
        )}
        {lastPage > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            {page > 1 ? <Link className={btn} href={pageLink(page - 1)}>← Previous</Link> : <span />}
            <span className="text-[var(--color-ink)]/70">Page {page} of {lastPage}</span>
            {page < lastPage ? <Link className={btn} href={pageLink(page + 1)}>Next →</Link> : <span />}
          </nav>
        )}
      </div>
    </div>
  );
}
