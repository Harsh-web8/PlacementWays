import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { listPractice } from "@/server/practice/queries";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/validation/question";

const DIFFICULTY_STYLE: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "bg-green-100 text-green-800",
  easy_medium: "bg-teal-100 text-teal-800",
  medium: "bg-amber-100 text-amber-800",
  medium_hard: "bg-orange-100 text-orange-800",
  hard: "bg-red-100 text-red-800",
};

export async function PracticeCatalog({
  searchParams,
  coding = false,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  coding?: boolean;
}) {
  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  const page = Math.min(10000, Math.max(1, Math.floor(Number(str("page"))) || 1));
  const filters = {
    category: str("category"),
    difficulty: str("difficulty"),
    q: str("q"),
    lesson: str("lesson"),
  };
  const result = await listPractice({ ...filters, page, coding });
  const base = coding ? "/coding" : "/practice";
  const link = (over: Partial<typeof filters> & { page?: number }) => {
    const merged = { ...filters, ...over };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, String(v));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };

  const cats = result.categories;
  const selected = cats.find((c) => c.id === filters.category);
  const topLevelId = selected?.parent_id ?? selected?.id ?? "";
  const topics = cats.filter((c) => !c.parent_id);
  const subtopics = topLevelId ? cats.filter((c) => c.parent_id === topLevelId) : [];
  const hasFilters = Boolean(filters.category || filters.difficulty || filters.q);
  const lastPage = Math.max(1, Math.ceil(result.total / 20));

  const chip = (active: boolean) =>
    `inline-flex items-center rounded-full border px-4 py-1.5 text-sm transition ${
      active
        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
        : "border-[var(--color-line)] bg-white hover:border-[var(--color-ink)]/50"
    }`;

  return (
    <div>
      <section className="bg-[var(--color-ink)] text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-12 md:py-14">
          <h1 className="font-serif text-3xl md:text-5xl">
            {coding ? "Coding practice" : "Practice questions"}
          </h1>
          <p className="mt-3 max-w-2xl text-white/80 md:text-lg">
            {coding
              ? "Build your approach, write a solution and study the explanation."
              : "Pick a topic, practise at your level and learn from every explanation."}
          </p>
          <form action={base} role="search" className="mt-7 flex max-w-xl gap-2">
            {filters.category && <input type="hidden" name="category" value={filters.category} />}
            {filters.difficulty && <input type="hidden" name="difficulty" value={filters.difficulty} />}
            {filters.lesson && <input type="hidden" name="lesson" value={filters.lesson} />}
            <label className="sr-only" htmlFor="practice-search">Search questions</label>
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink)]/50" />
              <input
                id="practice-search"
                name="q"
                defaultValue={filters.q}
                maxLength={200}
                placeholder="Search questions, e.g. percentages"
                className="h-12 w-full rounded-md bg-white pl-10 pr-3 text-[var(--color-ink)]"
              />
            </div>
            <button className="h-12 rounded-md bg-[var(--color-accent)] px-6 font-medium text-[var(--color-ink)] hover:opacity-90">
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
        {topics.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Topic</p>
            <div className="flex flex-wrap gap-2">
              <Link href={link({ category: "", page: 1 })} className={chip(!filters.category)}>All</Link>
              {topics.map((c) => (
                <Link key={c.id} href={link({ category: c.id, page: 1 })} className={chip(c.id === topLevelId)}>
                  {c.name}
                </Link>
              ))}
            </div>
            {subtopics.length > 0 && (
              <div className="flex flex-wrap gap-2 border-l-2 border-[var(--color-accent)] pl-3">
                {subtopics.map((c) => (
                  <Link key={c.id} href={link({ category: c.id, page: 1 })} className={chip(c.id === filters.category)}>
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold">Level</span>
          <Link href={link({ difficulty: "", page: 1 })} className={chip(!filters.difficulty)}>All</Link>
          {DIFFICULTIES.map((d) => (
            <Link key={d} href={link({ difficulty: d, page: 1 })} className={chip(filters.difficulty === d)}>
              {DIFFICULTY_LABELS[d]}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-5 text-sm">
          <p className="text-[var(--color-ink)]/70">
            <strong className="text-[var(--color-ink)]">{result.total}</strong>{" "}
            question{result.total === 1 ? "" : "s"}
          </p>
          {hasFilters && (
            <Link href={filters.lesson ? `${base}?lesson=${filters.lesson}` : base} className="underline">
              Clear filters
            </Link>
          )}
        </div>

        {result.questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
            <SearchX aria-hidden className="mx-auto h-8 w-8 text-[var(--color-ink)]/40" />
            <p className="mt-3 font-medium">No questions match these filters yet.</p>
            <p className="mt-1 text-sm text-[var(--color-ink)]/70">
              Try a different topic or level, or take a full mock test meanwhile.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {hasFilters && (
                <Link href={base} className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-ink)]/50">
                  Clear filters
                </Link>
              )}
              <Link href="/tests" className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-white hover:opacity-90">
                Browse mock tests
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.questions.map((q, i) => (
              <li key={q.id}>
                <Link
                  href={`/questions/${q.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-[var(--color-line)] bg-white p-4 transition hover:border-[var(--color-ink)]/40 hover:shadow-sm sm:p-5"
                >
                  <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-paper)] text-sm font-semibold ring-1 ring-[var(--color-line)] sm:flex">
                    {(page - 1) * 20 + i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium leading-6">{q.question_text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-[var(--color-paper)] px-2.5 py-1 ring-1 ring-[var(--color-line)]">
                        {q.category_name}
                      </span>
                      {q.difficulty && (
                        <span className={`rounded-full px-2.5 py-1 font-medium ${DIFFICULTY_STYLE[q.difficulty as (typeof DIFFICULTIES)[number]] ?? ""}`}>
                          {DIFFICULTY_LABELS[q.difficulty as (typeof DIFFICULTIES)[number]]}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight aria-hidden className="h-5 w-5 shrink-0 text-[var(--color-ink)]/40 transition group-hover:translate-x-1 group-hover:text-[var(--color-ink)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {lastPage > 1 && (
          <nav aria-label="Practice pages" className="flex items-center justify-between pt-2 text-sm">
            {page > 1 ? (
              <Link className="rounded-md border border-[var(--color-line)] bg-white px-4 py-2 hover:border-[var(--color-ink)]/50" href={link({ page: page - 1 })}>
                ← Previous
              </Link>
            ) : <span />}
            <span className="text-[var(--color-ink)]/70">Page {page} of {lastPage}</span>
            {page < lastPage ? (
              <Link className="rounded-md border border-[var(--color-line)] bg-white px-4 py-2 hover:border-[var(--color-ink)]/50" href={link({ page: page + 1 })}>
                Next →
              </Link>
            ) : <span />}
          </nav>
        )}
      </div>
    </div>
  );
}
