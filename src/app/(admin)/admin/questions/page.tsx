import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { listAdminQuestions } from "@/server/admin/questions/queries";
import { listAdminCategories } from "@/server/admin/categories/queries";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/status-badge";
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, DIFFICULTIES, QUESTION_TYPES } from "@/lib/validation/question";

export const metadata = { title: "Questions" };

function categoryLabel(id: string, categories: { id: string; name: string; parent_id: string | null }[]): string {
  const c = categories.find((cat) => cat.id === id);
  if (!c) return "Unknown";
  return c.parent_id ? `${categories.find((p) => p.id === c.parent_id)?.name ?? ""} \u203a ${c.name}` : c.name;
}

export default async function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const categoryId = typeof sp.category === "string" ? sp.category : "";
  const difficulty = typeof sp.difficulty === "string" ? sp.difficulty : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const questionType = typeof sp.type === "string" ? sp.type : "";
  const search = typeof sp.q === "string" ? sp.q : "";

  const [categories, result] = await Promise.all([
    listAdminCategories(),
    listAdminQuestions({ page, categoryId, difficulty, status, questionType, search }),
  ]);

  const baseParams: Record<string, string> = {
    ...(categoryId && { category: categoryId }),
    ...(difficulty && { difficulty }),
    ...(status && { status }),
    ...(questionType && { type: questionType }),
    ...(search && { q: search }),
  };
  const pageHref = (p: number) => `/admin/questions?${new URLSearchParams({ ...baseParams, page: String(p) })}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Questions</h1>
          <p className="mt-2 text-[var(--color-ink)]/70">{result.total} questions in the bank.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/questions/import">Import CSV</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/questions/new">Add question</Link>
          </Button>
        </div>
      </div>

      <form method="get" className="grid gap-4 rounded-sm border border-[var(--color-line)] p-4 sm:grid-cols-5">
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
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="flex items-end gap-3 sm:col-span-5">
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/questions">Clear</Link>
          </Button>
        </div>
      </form>

      {result.questions.length === 0 ? (
        <p className="text-[var(--color-ink)]/70">No questions match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[var(--color-line)]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Questions matching the current filters</caption>
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-ink)]/[0.02] text-[var(--color-ink)]/70">
                <th scope="col" className="px-4 py-3 font-medium">Question</th>
                <th scope="col" className="px-4 py-3 font-medium">Category</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">Difficulty</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {result.questions.map((q) => (
                <tr key={q.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="max-w-xs truncate px-4 py-3">{q.question_text}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">{categoryLabel(q.category_id, categories)}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">{QUESTION_TYPE_LABELS[q.question_type]}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">{DIFFICULTY_LABELS[q.difficulty]}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/questions/${q.id}`} className="underline underline-offset-4 hover:no-underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pageCount > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none text-[var(--color-ink)]/30" : "underline underline-offset-4 hover:no-underline"}
          >
            &larr; Previous
          </Link>
          <span className="text-sm text-[var(--color-ink)]/70">
            Page {result.page} of {result.pageCount}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= result.pageCount}
            className={page >= result.pageCount ? "pointer-events-none text-[var(--color-ink)]/30" : "underline underline-offset-4 hover:no-underline"}
          >
            Next &rarr;
          </Link>
        </nav>
      )}
    </div>
  );
}
