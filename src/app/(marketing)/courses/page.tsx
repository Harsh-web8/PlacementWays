import Link from "next/link";
import { z } from "zod";
import { listCourses } from "@/server/learning/queries";
import { getPublishedCompanies } from "@/server/companies/queries";
import { CourseCard } from "@/components/learning/course-card";
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
  const pageLink = (n: number) =>
    `?${new URLSearchParams({ q, company: company ?? "", page: String(n) })}`;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-12">
      <h1 className="font-serif text-4xl">Learn with a clear path</h1>
      <p>
        Build understanding one lesson at a time, then put it into practice.
      </p>
      <form className="flex flex-wrap items-end gap-4" role="search">
        <label className="grid gap-2 text-sm">
          Search courses
          <input
            className="rounded border p-3"
            name="q"
            defaultValue={q}
            maxLength={100}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Company
          <select
            name="company"
            defaultValue={company ?? ""}
            className="rounded border p-3"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded bg-[var(--color-ink)] p-3 text-white">
          Find courses
        </button>
      </form>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
      {!courses.length && <p>No published courses match your search yet.</p>}
      <nav aria-label="Pagination" className="flex gap-5">
        {page > 1 && <Link href={pageLink(page - 1)}>Previous</Link>}
        {page * 12 < total && <Link href={pageLink(page + 1)}>Next</Link>}
      </nav>
    </div>
  );
}
