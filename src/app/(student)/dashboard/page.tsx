import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { getLearningProgress, getSyllabus } from "@/server/learning/queries";
import { formatMarks } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const learning = await getLearningProgress(user.id);
  const courseProgress = await Promise.all(
    learning.courses
      .filter((c) => c.courses?.status === "published")
      .slice(0, 6)
      .map(async (c) => {
        const lessons = (await getSyllabus(c.course_id)).flatMap(
          (m) => m.lessons,
        );
        return {
          ...c,
          total: lessons.length,
          completed: lessons.filter((l) => learning.completed.has(l.id)).length,
          next: lessons.find((l) => !learning.completed.has(l.id)),
        };
      }),
  );

  // Runs as the student: Row Level Security limits this to THEIR attempts.
  const supabase = await createClient();
  const [{ count: attempts, error: countError }, { data: recent, error: recentError }] = await Promise.all([
    supabase
      .from("test_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("test_attempts")
      .select("id, test_id, status, score, total_marks, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  if (countError || recentError) throw new Error("Unable to load your test activity. Please try again.");

  const testIds = [...new Set((recent ?? []).map((a) => a.test_id))];
  const testTitles = new Map<string, string>();
  if (testIds.length > 0) {
    const { data: tests, error: testsError } = await supabase
      .from("mock_tests")
      .select("id, title")
      .in("id", testIds);
    if (testsError) throw new Error("Unable to load your recent tests. Please try again.");
    for (const t of tests ?? []) testTitles.set(t.id, t.title);
  }

  const fields = [user.college, user.degree, user.graduationYear];
  const done = fields.filter((f) => f !== null && f !== "").length;

  return (
    <div className="space-y-8">
      {sp.notice === "password-updated" && (
        <Alert variant="success">Your password has been updated.</Alert>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">
            Hello, {user.name.split(" ")[0] || "there"}
          </h1>
          <p className="mt-2 text-[var(--color-ink)]/70">
            Your preparation hub.
          </p>
        </div>
        <Button asChild>
          <Link href="/tests">Browse mock tests</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section
          className="rounded-sm border border-[var(--color-line)] bg-white p-6"
          aria-labelledby="attempts-h"
        >
          <h2
            id="attempts-h"
            className="text-sm font-medium text-[var(--color-ink)]/70"
          >
            Tests attempted
          </h2>
          <p className="mt-2 font-serif text-4xl">{attempts ?? 0}</p>
          {(attempts ?? 0) === 0 && (
            <p className="mt-2 text-sm text-[var(--color-ink)]/70">
              No attempts yet. Your results will show up here.
            </p>
          )}
        </section>
        <section
          className="rounded-sm border border-[var(--color-line)] bg-white p-6"
          aria-labelledby="profile-h"
        >
          <h2
            id="profile-h"
            className="text-sm font-medium text-[var(--color-ink)]/70"
          >
            Profile details
          </h2>
          <p className="mt-2 font-serif text-4xl">{done}/3</p>
          <p className="mt-2 text-sm text-[var(--color-ink)]/70">
            College, degree and graduation year help us tailor practice.
          </p>
        </section>
      </div>

      <section aria-labelledby="learning-h">
        <h2 id="learning-h" className="font-serif text-2xl">
          Continue learning
        </h2>
        {!courseProgress.length && (
          <p className="mt-3">
            Start a course to see your progress here.{" "}
            <Link className="underline" href="/courses">
              Explore courses
            </Link>
          </p>
        )}
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {courseProgress.map((c) => (
            <li
              key={c.course_id}
              className="rounded border border-[var(--color-line)] p-5"
            >
              <h3 className="font-semibold">{c.courses?.title}</h3>
              <p className="my-3 text-sm">
                {c.completed} / {c.total} lessons completed
              </p>
              <progress
                className="w-full"
                aria-label={`${c.courses?.title} completion`}
                value={c.completed}
                max={c.total || 1}
              />
              <Link
                className="mt-3 block underline"
                href={
                  c.next
                    ? `/courses/${c.courses?.slug}/lessons/${c.next.id}`
                    : `/courses/${c.courses?.slug}`
                }
              >
                {c.next ? `Continue: ${c.next.title}` : "Review course"}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border p-5"><h2 className="font-serif text-2xl">Find your next step</h2><p className="my-3">Review strong and weak topics, recommended lessons and your latest mock trends.</p><Link className="underline" href="/progress">View analytics and recommendations</Link></section>

      <section aria-labelledby="recent-h">
        <h2
          id="recent-h"
          className="text-sm font-medium text-[var(--color-ink)]/70"
        >
          Recent attempts
        </h2>
        {!recent || recent.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink)]/70">
            Nothing here yet -- your attempts will show up as soon as you take a
            test.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-line)] rounded-sm border border-[var(--color-line)] bg-white">
            {recent.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {testTitles.get(a.test_id) ?? "Mock test"}
                  </p>
                  <p className="text-xs text-[var(--color-ink)]/60">
                    {new Date(a.started_at).toLocaleDateString("en-IN")}{" "}
                    &middot;{" "}
                    {a.status === "in_progress"
                      ? "In progress"
                      : `${formatMarks(a.score ?? 0)} / ${formatMarks(a.total_marks ?? 0)}`}
                  </p>
                </div>
                <Link
                  href={
                    a.status === "in_progress"
                      ? `/attempts/${a.id}`
                      : `/attempts/${a.id}/result`
                  }
                  className="shrink-0 text-sm underline underline-offset-4 hover:no-underline"
                >
                  {a.status === "in_progress" ? "Resume" : "View result"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
