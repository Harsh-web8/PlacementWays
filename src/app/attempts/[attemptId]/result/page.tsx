import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, XCircle, MinusCircle, Bookmark } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getAttemptState, getAttemptResult } from "@/server/attempts/queries";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { RegistrationPrompt } from "@/components/tests/registration-prompt";
import { ActionForm } from "@/components/learning/action-form";
import { claimGuestResult } from "@/server/attempts/actions";
import { cn } from "@/lib/utils";
import { formatDurationWords, formatMarks, accuracyPercent } from "@/lib/format";
import { DIFFICULTY_LABELS } from "@/lib/validation/question";

export const metadata: Metadata = { title: "Test result", robots: { index: false, follow: false } };

export default async function AttemptResultPage({ params }: PageProps<"/attempts/[attemptId]/result">) {
  const user = await getCurrentUser();
  const { attemptId } = await params;

  // Still running? Send them back to finish rather than showing a 404.
  const state = await getAttemptState(attemptId);
  if (!state) notFound();
  if (state.attempt.status === "in_progress") redirect(`/attempts/${attemptId}`);

  const result = await getAttemptResult(attemptId);
  if (!result) notFound();

  const saved = user ? !!(await (await createClient()).from("test_attempts").select("id").eq("id",attemptId).eq("user_id",user.id).maybeSingle()).data : false;
  const { attempt, summary } = result;
  const accuracy = accuracyPercent(summary.correct, summary.incorrect);

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <header className="border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Brand className="text-xl" />
          <Button asChild variant="outline" size="sm">
            <Link href={user ? "/dashboard" : "/tests"}>{user ? "Dashboard" : "Explore mocks"}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            {attempt.status === "expired" ? "Time expired" : "Submitted"}
          </p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">{result.test.title}</h1>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-sm border border-[var(--color-line)] bg-white p-5 sm:grid-cols-4">
          <Stat label="Score" value={`${formatMarks(attempt.score)} / ${formatMarks(attempt.total_marks)}`} />
          <Stat label="Percentage" value={`${attempt.total_marks ? Math.round(attempt.score / attempt.total_marks * 100) : 0}%`} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Time used" value={formatDurationWords(attempt.time_used_seconds)} />
          <Stat label="Questions" value={String(summary.question_count)} />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div className="rounded-sm border border-[var(--color-line)] bg-white py-3">
            <p className="font-serif text-2xl text-[var(--color-success)]">{summary.correct}</p>
            <p className="text-[var(--color-ink)]/60">Correct</p>
          </div>
          <div className="rounded-sm border border-[var(--color-line)] bg-white py-3">
            <p className="font-serif text-2xl text-[var(--color-danger)]">{summary.incorrect}</p>
            <p className="text-[var(--color-ink)]/60">Incorrect</p>
          </div>
          <div className="rounded-sm border border-[var(--color-line)] bg-white py-3">
            <p className="font-serif text-2xl text-[var(--color-ink)]/60">{summary.unanswered}</p>
            <p className="text-[var(--color-ink)]/60">Unanswered</p>
          </div>
        </div>

        {user ? <>{!saved && <ActionForm label="Save this result to my account" action={claimGuestResult.bind(null, attemptId)} />}<Link className="block underline" href="/progress">Review weak topics and recommended lessons</Link></> : <RegistrationPrompt result next={`/attempts/${attemptId}/result`} />}
        <div className="space-y-4">
          <h2 className="font-serif text-2xl">Question review</h2>
          {result.questions.map((q, i) => (
            <article key={q.id} className="rounded-sm border border-[var(--color-line)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-xs font-medium text-[var(--color-ink)]/60">
                  Question {i + 1} &middot; {q.category_name} &middot; {DIFFICULTY_LABELS[q.difficulty]}
                  {q.marked_for_review && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[var(--color-accent)]">
                      <Bookmark aria-hidden className="size-3 fill-current" /> Marked for review
                    </span>
                  )}
                </p>
                <OutcomeBadge isCorrect={q.is_correct} marksAwarded={q.marks_awarded} />
              </div>

              <p className="mt-2 whitespace-pre-wrap text-base leading-7">{q.text}</p>

              {q.options.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {q.options.map((opt) => {
                    const isCorrectOption = opt.key === q.correct_answer;
                    const isSelected = opt.key === q.selected_answer;
                    return (
                      <li
                        key={opt.key}
                        className={cn(
                          "flex items-start gap-2 rounded-sm border px-3 py-2 text-sm",
                          isCorrectOption
                            ? "border-[var(--color-success)] bg-[var(--color-success)]/5"
                            : isSelected
                              ? "border-[var(--color-danger)] bg-[var(--color-danger)]/5"
                              : "border-[var(--color-line)]",
                        )}
                      >
                        <span className="font-semibold">{opt.key}.</span>
                        <span className="min-w-0 whitespace-pre-wrap break-words">{opt.text}</span>
                        {isCorrectOption && <CheckCircle2 aria-hidden className="ml-auto size-4 shrink-0 text-[var(--color-success)]" />}
                        {isSelected && !isCorrectOption && <XCircle aria-hidden className="ml-auto size-4 shrink-0 text-[var(--color-danger)]" />}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm italic text-[var(--color-ink)]/60">This question type isn&apos;t auto-scored online yet.</p>
              )}

              {q.explanation && (
                <div className="mt-4 rounded-sm bg-[var(--color-ink)]/[0.03] p-3 text-sm leading-6">
                  <p className="mb-1 font-medium">Explanation</p>
                  <p className="whitespace-pre-wrap text-[var(--color-ink)]/75">{q.explanation}</p>
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 pt-4">
          <Button asChild>
            <Link href="/tests">Take another test</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={user ? "/dashboard" : "/companies"}>{user ? "Back to dashboard" : "Explore companies"}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-ink)]/60">{label}</p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
    </div>
  );
}

function OutcomeBadge({ isCorrect, marksAwarded }: { isCorrect: boolean | null; marksAwarded: number | null }) {
  if (isCorrect === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-ink)]/6 px-2.5 py-1 text-xs font-medium">
        <MinusCircle aria-hidden className="size-3.5" /> Not answered
      </span>
    );
  }
  const marksText = marksAwarded !== null ? ` (${marksAwarded > 0 ? "+" : ""}${formatMarks(marksAwarded)})` : "";
  return isCorrect ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/12 px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
      <CheckCircle2 aria-hidden className="size-3.5" /> Correct{marksText}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)]">
      <XCircle aria-hidden className="size-3.5" /> Incorrect{marksText}
    </span>
  );
}
