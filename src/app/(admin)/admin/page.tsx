import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth/session";
import { Button } from "@/components/ui/button";

async function count(
  table:
    | "companies"
    | "categories"
    | "questions"
    | "mock_tests"
    | "recruitment_processes"
    | "profiles"
    | "courses",
) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if(error)throw new Error("Could not load admin totals.");
  return count ?? 0;
}

export default async function AdminHome() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const [companies, processes, categories, questions, tests, users, courses] =
    await Promise.all([
      count("companies"),
      count("recruitment_processes"),
      count("categories"),
      count("questions"),
      count("mock_tests"),
      count("profiles"),
      count("courses"),
    ]);
  const stats = [
    ["Companies", companies],
    ["Recruitment processes", processes],
    ["Categories", categories],
    ["Questions", questions],
    ["Mock tests", tests],
    ["Users", users],
    ["Courses", courses],
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Admin overview</h1>
          <p className="mt-2 text-[var(--color-ink)]/70">
            Live counts from the database.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/companies">Manage companies</Link>
        </Button>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, n]) => (
          <div
            key={label}
            className="rounded-sm border border-[var(--color-line)] bg-white p-6"
          >
            <dt className="text-sm font-medium text-[var(--color-ink)]/70">
              {label}
            </dt>
            <dd className="mt-2 font-serif text-4xl">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
