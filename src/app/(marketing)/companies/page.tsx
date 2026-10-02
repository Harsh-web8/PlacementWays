import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { getPublishedCompanies } from "@/server/companies/queries";
export const metadata = { title: "Company preparation" };
export default async function CompaniesPage({
  searchParams,
}: PageProps<"/companies">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100).trim() : "";
  const all = await getPublishedCompanies();
  const companies = all.filter((c) =>
    `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div>
      <section className="bg-[var(--color-ink)] text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
          <h1 className="font-serif text-3xl md:text-5xl">
            Find your preparation path
          </h1>
          <p className="mt-3 max-w-2xl text-white/80 md:text-lg">
            Pick the company you are targeting. See its exam pattern,
            eligibility and syllabus, then practise with timed mocks.
          </p>
          <form className="mt-7 flex max-w-xl gap-2" role="search">
            <label className="sr-only" htmlFor="company-search">
              Search companies
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink)]/50"
              />
              <input
                id="company-search"
                name="q"
                defaultValue={q}
                maxLength={100}
                placeholder="Search TCS, Infosys, Wipro…"
                className="h-12 w-full rounded-md bg-white pl-10 pr-3 text-[var(--color-ink)]"
              />
            </div>
            <button className="h-12 rounded-md bg-[var(--color-accent)] px-6 font-medium text-[var(--color-ink)] hover:opacity-90">
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="mb-6 text-sm text-[var(--color-ink)]/60">
          {q
            ? `${companies.length} result${companies.length === 1 ? "" : "s"} for “${q}”`
            : `${all.length} compan${all.length === 1 ? "y" : "ies"}`}
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/companies/${c.slug}`}
              className="group flex flex-col rounded-xl border border-[var(--color-line)] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[var(--color-ink)]/40 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink)] font-serif text-xl text-white"
                >
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
                <h2 className="font-serif text-xl leading-snug">{c.name}</h2>
              </div>
              <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-[var(--color-ink)]/75">
                {c.description}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                Pattern, eligibility &amp; mocks
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
        {!companies.length && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-ink)]/70">
            {q
              ? "No companies match your search. Try a shorter name."
              : "Company guides are being added. Check back soon."}
          </p>
        )}
      </div>
    </div>
  );
}
