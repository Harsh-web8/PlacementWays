import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { getAdminMockTest, getAdminMockTestWithDetails } from "@/server/admin/tests/queries";
import { listAdminQuestions } from "@/server/admin/questions/queries";
import { listAdminCategories } from "@/server/admin/categories/queries";
import { addTestQuestion } from "@/server/admin/tests/actions";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, DIFFICULTIES, QUESTION_TYPES } from "@/lib/validation/question";

export async function generateMetadata({ params }: PageProps<"/admin/tests/[testId]/add-questions">) {
  const { testId } = await params;
  const test = await getAdminMockTest(testId);
  return { title: test ? `Add questions \u2014 ${test.title}` : "Add questions" };
}

export default async function AddQuestionsToTestPage({
  params,
  searchParams,
}: PageProps<"/admin/tests/[testId]/add-questions">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const { testId } = await params;
  const sp = await searchParams;

  const requestedPage = Number(sp.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const categoryId = typeof sp.category === "string" ? sp.category : "";
  const difficulty = typeof sp.difficulty === "string" ? sp.difficulty : "";
  const questionType = typeof sp.type === "string" ? sp.type : "";
  const search = typeof sp.q === "string" ? sp.q : "";

  const [testDetails, categories, result] = await Promise.all([
    getAdminMockTestWithDetails(testId),
    listAdminCategories(),
    listAdminQuestions({ page, categoryId, difficulty, questionType, search, status: "published" }),
  ]);
  if (!testDetails) notFound();

  const assignedIds = new Set(testDetails.questions.map((q) => q.testQuestion.question_id));
  const candidates = result.questions.filter((q) => !assignedIds.has(q.id));

  const pageHref = (target: number) => {
    const query = new URLSearchParams({ page: String(target) });
    for (const [key, value] of Object.entries({ category: categoryId, difficulty, type: questionType, q: search })) {
      if (value) query.set(key, value);
    }
    return `/admin/tests/${testId}/add-questions?${query}`;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/admin/tests/${testId}`} className="text-sm text-[var(--color-ink)]/60 underline underline-offset-4 hover:no-underline">
          &larr; {testDetails.test.title}
        </Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Add questions</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">Showing published questions only. {assignedIds.size} already assigned.</p>
      </div>

      <form method="get" className="grid gap-4 rounded-sm border border-[var(--color-line)] p-4 sm:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="q">Search text</Label>
          <Input id="q" name="q" defaultValue={search} placeholder="Search question text..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue={categoryId}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? `\u2014 ${c.name}` : c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select id="difficulty" name="difficulty" defaultValue={difficulty}>
            <option value="">All</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue={questionType}>
            <option value="">All</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-3 sm:col-span-4">
          <Button type="submit" size="sm">
            Apply filters
          </Button>
        </div>
      </form>

      {candidates.length === 0 ? (
        <p className="text-[var(--color-ink)]/70">No unassigned questions on this page. Browse another page or change your filters.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] rounded-sm border border-[var(--color-line)]">
          {candidates.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{q.question_text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink)]/60">
                  <span>{QUESTION_TYPE_LABELS[q.question_type]}</span>
                  <span>&middot;</span>
                  <span>{DIFFICULTY_LABELS[q.difficulty]}</span>
                  <StatusBadge status={q.status} />
                </p>
              </div>
              <ActionButton action={addTestQuestion.bind(null, testId, q.id)} variant="outline" size="sm" className="shrink-0">
                Add
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Question pages" className="flex items-center justify-between gap-4">
        {page > 1 ? <Link className="underline" href={pageHref(page - 1)}>Previous page</Link> : <span />}
        <span>Page {page} · {result.total} matching published questions</span>
        {page < result.pageCount ? <Link className="underline" href={pageHref(page + 1)}>Next page</Link> : <span />}
      </nav>
    </div>
  );
}
