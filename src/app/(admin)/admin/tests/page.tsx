import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { listAdminMockTests } from "@/server/admin/tests/queries";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { DIFFICULTY_LABELS } from "@/lib/validation/question";

export const metadata = { title: "Mock tests" };

export default async function AdminTestsPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const tests = await listAdminMockTests();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Mock tests</h1>
          <p className="mt-2 text-[var(--color-ink)]/70">{tests.length} tests.</p>
        </div>
        <Button asChild>
          <Link href="/admin/tests/new">Add mock test</Link>
        </Button>
      </div>

      {tests.length === 0 ? (
        <p className="text-[var(--color-ink)]/70">No mock tests yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[var(--color-line)]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">All mock tests, including drafts and archived entries</caption>
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-ink)]/[0.02] text-[var(--color-ink)]/70">
                <th scope="col" className="px-4 py-3 font-medium">Title</th>
                <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                <th scope="col" className="px-4 py-3 font-medium">Difficulty</th>
                <th scope="col" className="px-4 py-3 font-medium">Access</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">{t.duration_minutes} min</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">{DIFFICULTY_LABELS[t.difficulty]}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">{t.is_free ? "Free" : "Premium"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/tests/${t.id}`} className="underline underline-offset-4 hover:no-underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
