import Link from "next/link";
import type { Metadata } from "next";
import { Clock, FileQuestion, Users, ShieldAlert } from "lucide-react";
import { listPublishedTests, getFilterOptions, DURATION_OPTIONS, MIN_QUESTION_OPTIONS } from "@/server/tests/queries";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DIFFICULTY_LABELS, DIFFICULTIES } from "@/lib/validation/question";

export const metadata: Metadata = {
  title: "Mock tests",
  description: "Company-specific and topic-wise mock tests for Indian placement preparation.",
};

function isDifficulty(v: string): v is "easy" | "easy_medium" | "medium" | "medium_hard" | "hard" {
  return (DIFFICULTIES as readonly string[]).includes(v);
}

export default async function TestsPage({ searchParams }: PageProps<"/tests">) {
  const sp = await searchParams;
  const company = typeof sp.company === "string" ? sp.company : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const difficultyRaw = typeof sp.difficulty === "string" ? sp.difficulty : "";
  const difficulty = isDifficulty(difficultyRaw) ? difficultyRaw : undefined;
  const access = sp.access === "free" || sp.access === "premium" ? sp.access : undefined;
  const maxDuration = Number(sp.maxDuration) || undefined;
  const minQuestions = Number(sp.minQuestions) || undefined;
  const sort = sp.sort === "popular" ? "popular" : "newest";
  const page = Math.min(10000, Math.max(1, Math.floor(Number(sp.page) || 1)));
  const activeFilters = {
    ...(company && { company }),
    ...(category && { category }),
    ...(difficulty && { difficulty }),
    ...(access && { access }),
    ...(maxDuration && { maxDuration: String(maxDuration) }),
    ...(minQuestions && { minQuestions: String(minQuestions) }),
  };
  const href = (nextSort: string, nextPage: number) =>
    `/tests?${new URLSearchParams({ ...activeFilters, sort: nextSort, page: String(nextPage) })}`;

  const [{ companies, categories }, result] = await Promise.all([
    getFilterOptions(),
    listPublishedTests({ company, category, difficulty, access, maxDuration, minQuestions, sort, page }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">Practice tests</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Mock tests</h1>
        <p className="mt-4 text-[var(--color-ink)]/70">
          {result.total} test{result.total === 1 ? "" : "s"} available. Company-specific patterns are informational, not guaranteed --
          see each company&apos;s recruitment page for sources and the last-verified date.
        </p>
      </div>

      <form method="get" className="mt-8 grid gap-4 rounded-sm border border-[var(--color-line)] bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Select id="company" name="company" defaultValue={company}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Topic</Label>
          <Select id="category" name="category" defaultValue={category}>
            <option value="">All topics</option>
            {categories
              .filter((c) => !c.parent_id)
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select id="difficulty" name="difficulty" defaultValue={difficulty ?? ""}>
            <option value="">All</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="access">Access</Label>
          <Select id="access" name="access" defaultValue={access ?? ""}>
            <option value="">Free &amp; premium</option>
            <option value="free">Free only</option>
            <option value="premium">Premium only</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxDuration">Max duration</Label>
          <Select id="maxDuration" name="maxDuration" defaultValue={maxDuration ? String(maxDuration) : ""}>
            <option value="">Any</option>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="minQuestions">Min. questions</Label>
          <Select id="minQuestions" name="minQuestions" defaultValue={minQuestions ? String(minQuestions) : ""}>
            <option value="">Any</option>
            {MIN_QUESTION_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-3 sm:col-span-3 lg:col-span-6">
          <input type="hidden" name="sort" value={sort} />
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/tests">Clear</Link>
          </Button>
          <div className="ml-auto flex gap-2 text-sm">
            <Link
              href={href("newest", 1)}
              className={sort === "newest" ? "font-semibold underline underline-offset-4" : "text-[var(--color-ink)]/60 hover:underline"}
            >
              Newest
            </Link>
            <Link
              href={href("popular", 1)}
              className={sort === "popular" ? "font-semibold underline underline-offset-4" : "text-[var(--color-ink)]/60 hover:underline"}
            >
              Most attempted
            </Link>
          </div>
        </div>
      </form>

      {result.tests.length === 0 ? (
        <p className="mt-10 text-[var(--color-ink)]/70">No tests match these filters yet. Try clearing a filter.</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.tests.map((t) => (
            <Link
              key={t.id}
              href={`/tests/${t.slug}`}
              className="flex flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 transition-colors hover:border-[var(--color-ink)]/40"
            >
              <div className="flex items-center justify-between gap-2">
                {t.companyName && <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">{t.companyName}</span>}
                <span className="ml-auto rounded-full bg-[var(--color-ink)]/6 px-2.5 py-1 text-xs font-medium">
                  {t.isFree ? "Free" : "Premium"}
                </span>
              </div>
              <h2 className="mt-3 font-serif text-xl leading-snug">{t.title}</h2>
              {t.description && <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink)]/65">{t.description}</p>}
              <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink)]/60">
                <div className="flex items-center gap-1.5">
                  <Clock aria-hidden className="size-3.5" /> <dd>{t.durationMinutes} min</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileQuestion aria-hidden className="size-3.5" /> <dd>{t.questionCount} questions</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users aria-hidden className="size-3.5" /> <dd>{t.attemptCount} attempts</dd>
                </div>
                {t.hasNegativeMarking && (
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert aria-hidden className="size-3.5" /> <dd>Negative marking</dd>
                  </div>
                )}
              </dl>
              <span className="mt-4 text-sm font-medium">{DIFFICULTY_LABELS[t.difficulty]}</span>
            </Link>
          ))}
        </div>
      )}

      {result.pageCount > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-6" aria-label="Pagination">
          <Link
            href={href(sort, Math.max(1, result.page - 1))}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none text-[var(--color-ink)]/30" : "underline underline-offset-4"}
          >
            &larr; Previous
          </Link>
          <span className="text-sm text-[var(--color-ink)]/70">
            Page {result.page} of {result.pageCount}
          </span>
          <Link
            href={href(sort, Math.min(result.pageCount, result.page + 1))}
            aria-disabled={page >= result.pageCount}
            className={page >= result.pageCount ? "pointer-events-none text-[var(--color-ink)]/30" : "underline underline-offset-4"}
          >
            Next &rarr;
          </Link>
        </nav>
      )}
    </div>
  );
}
