"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, ChevronRight, Loader2, Menu, WifiOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatClock, formatMarks } from "@/lib/format";
import { saveAnswer, submitAttempt } from "@/server/attempts/actions";
import type { AttemptState } from "@/lib/attempts/schemas";

type Answer = { selected: string | null; marked: boolean };
type AnswerMap = Record<string, Answer>;
type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY_ANSWER: Answer = { selected: null, marked: false };

/**
 * The client only ever holds what the server chose to send during the test:
 * question text, options and the student's own answers -- never the correct
 * answers. Time and scoring are enforced by the database; the countdown here
 * is a convenience, not the authority.
 */
export function TestRunner({ state }: { state: AttemptState }) {
  const router = useRouter();
  const attemptId = state.attempt.id;
  const questions = state.questions ?? [];
  const resultHref = `/attempts/${attemptId}/result`;

  const [answers, setAnswers] = useState<AnswerMap>(() =>
    Object.fromEntries((state.answers ?? []).map((a) => [a.question_id, { selected: a.selected_answer, marked: a.marked_for_review }])),
  );
  const [index, setIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Remaining time at the moment the server rendered this page. From here we
  // count with the browser's monotonic clock, so a wrong device clock or a
  // changed timezone can't shift the countdown.
  const initialRemainingMs = Math.max(0, Date.parse(state.attempt.expires_at) - Date.parse(state.attempt.server_now));
  const [remaining, setRemaining] = useState(Math.ceil(initialRemainingMs / 1000));

  const answersRef = useRef(answers);
  const dirty = useRef(new Set<string>());
  const flushing = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const retryTimer = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const lastSubmitAt = useRef(0);
  const finished = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // ---- saving -----------------------------------------------------------
  const flush = useCallback(async () => {
    if (flushing.current || finished.current) return;
    flushing.current = true;
    try {
      while (dirty.current.size > 0) {
        const id = dirty.current.values().next().value as string;
        const sent = answersRef.current[id] ?? EMPTY_ANSWER;
        setSaveState("saving");
        const res = await saveAnswer({ attemptId, questionId: id, selected: sent.selected, marked: sent.marked });

        if (res.status === "closed") {
          finished.current = true;
          router.replace(resultHref);
          return;
        }
        if (res.status === "error") throw new Error("temporary save failure");

        // "saved" or "rejected" (permanently invalid): either way stop retrying this one,
        // unless the student changed it again while the request was in flight.
        const latest = answersRef.current[id] ?? EMPTY_ANSWER;
        if (latest.selected === sent.selected && latest.marked === sent.marked) dirty.current.delete(id);
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        void flushRef.current();
      }, 4000);
    } finally {
      flushing.current = false;
    }
  }, [attemptId, router, resultHref]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    return () => {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    };
  }, []);

  const updateAnswer = useCallback(
    (questionId: string, patch: Partial<Answer>) => {
      const next = { ...(answersRef.current[questionId] ?? EMPTY_ANSWER), ...patch };
      answersRef.current = { ...answersRef.current, [questionId]: next };
      setAnswers(answersRef.current);
      dirty.current.add(questionId);
      void flush();
    },
    [flush],
  );

  // Warn before leaving only while something hasn't reached the server yet.
  useEffect(() => {
    if (saveState !== "error" && saveState !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  // ---- submitting ---------------------------------------------------------
  const doSubmit = useCallback(async () => {
    if (submittingRef.current || finished.current) return;
    submittingRef.current = true;
    lastSubmitAt.current = performance.now();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = Object.entries(answersRef.current).map(([questionId, a]) => ({
        questionId,
        selected: a.selected,
        marked: a.marked,
      }));
      const res = await submitAttempt({ attemptId, answers: payload });
      if (res.status === "error") throw new Error("submit failed");
      finished.current = true;
      router.replace(resultHref);
    } catch {
      setSubmitError("We couldn't reach the server. Your answers are saved -- check your connection and try again.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attemptId, router, resultHref]);

  // ---- countdown ----------------------------------------------------------
  useEffect(() => {
    const start = performance.now();
    const announced = new Set<number>();
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((initialRemainingMs - (performance.now() - start)) / 1000));
      setRemaining(left);

      for (const mark of [600, 300, 60]) {
        if (left <= mark && left > 0 && !announced.has(mark) && initialRemainingMs / 1000 > mark) {
          announced.add(mark);
          setAnnouncement(`${mark / 60} ${mark === 60 ? "minute" : "minutes"} remaining.`);
        }
      }

      // Out of time: submit automatically, retrying every few seconds if the network is down.
      if (left <= 0 && !submittingRef.current && !finished.current && performance.now() - lastSubmitAt.current > 3000) {
        void doSubmit();
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [initialRemainingMs, doSubmit]);

  // ---- derived ------------------------------------------------------------
  const current = questions[index];
  const answeredCount = questions.filter((q) => answers[q.id]?.selected).length;
  const markedCount = questions.filter((q) => answers[q.id]?.marked).length;
  const unansweredCount = questions.length - answeredCount;
  const currentAnswer = current ? (answers[current.id] ?? EMPTY_ANSWER) : EMPTY_ANSWER;
  const lowTime = remaining <= 300;

  if (questions.length === 0 || !current) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Alert variant="error">This test has no questions to show. Please go back and try again.</Alert>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="min-w-0 truncate text-sm font-semibold sm:text-base">{state.test.title}</h1>
          <div className="flex shrink-0 items-center gap-3">
            <SaveIndicator state={saveState} />
            <div
              role="timer"
              aria-label="Time remaining"
              className={cn(
                "rounded-sm border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums sm:text-base",
                lowTime ? "border-[var(--color-danger)] text-[var(--color-danger)]" : "border-[var(--color-line)]",
              )}
            >
              {formatClock(remaining)}
            </div>
            <Button size="sm" onClick={() => dialogRef.current?.showModal()} disabled={submitting}>
              Submit
            </Button>
          </div>
        </div>
      </header>

      {/* Announced politely at 10, 5 and 1 minutes left -- the ticking clock itself is not announced. */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_280px]">
        <main className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-ink)]/70">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span>
              {formatMarks(current.marks)} {current.marks === 1 ? "mark" : "marks"}
              {current.negative_marks > 0 ? ` \u00b7 \u2212${formatMarks(current.negative_marks)} for a wrong answer` : ""}
            </span>
          </div>

          <fieldset className="space-y-4">
            <legend className="whitespace-pre-wrap break-words text-base leading-7 sm:text-lg">{current.text}</legend>

            {current.type !== "mcq" ? (
              <Alert variant="info">This question type can&apos;t be answered online yet. It will count as unanswered.</Alert>
            ) : (
              <div className="space-y-2">
                {current.options.map((option) => {
                  const checked = currentAnswer.selected === option.key;
                  return (
                    <label
                      key={option.key}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-sm border bg-white px-4 py-3 text-sm leading-6 sm:text-base",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-focus)]",
                        checked ? "border-[var(--color-ink)] bg-[var(--color-ink)]/[0.04]" : "border-[var(--color-line)] hover:border-[var(--color-ink)]/40",
                      )}
                    >
                      <input
                        type="radio"
                        name={`question-${current.id}`}
                        value={option.key}
                        checked={checked}
                        onChange={() => updateAnswer(current.id, { selected: option.key })}
                        className="mt-1.5 size-4 shrink-0 accent-[var(--color-ink)]"
                      />
                      <span className="font-semibold">{option.key}.</span>
                      <span className="min-w-0 whitespace-pre-wrap break-words">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={currentAnswer.marked}
              onClick={() => updateAnswer(current.id, { marked: !currentAnswer.marked })}
            >
              <Bookmark aria-hidden className={currentAnswer.marked ? "fill-current" : ""} />
              {currentAnswer.marked ? "Marked for review" : "Mark for review"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!currentAnswer.selected}
              onClick={() => updateAnswer(current.id, { selected: null })}
            >
              Clear answer
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-4">
            <Button type="button" variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <Button type="button" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={index === questions.length - 1}>
              Next <ChevronRight aria-hidden />
            </Button>
          </div>
        </main>

        <aside aria-label="Question navigator" className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-sm border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-medium lg:hidden"
            aria-expanded={paletteOpen}
            aria-controls="question-palette"
            onClick={() => setPaletteOpen((o) => !o)}
          >
            <span className="flex items-center gap-2">
              <Menu aria-hidden className="size-4" /> Questions
            </span>
            <span className="text-[var(--color-ink)]/70">
              {answeredCount}/{questions.length} answered
            </span>
          </button>

          <div id="question-palette" className={cn("rounded-sm border border-[var(--color-line)] bg-white p-4", paletteOpen ? "block" : "hidden", "lg:block")}>
            <p className="mb-3 hidden text-sm font-medium lg:block">
              {answeredCount} of {questions.length} answered
            </p>
            <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
              {questions.map((q, i) => {
                const a = answers[q.id];
                const status = [a?.selected ? "answered" : "not answered", a?.marked ? "marked for review" : null].filter(Boolean).join(", ");
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      aria-label={`Question ${i + 1}: ${status}`}
                      aria-current={i === index ? "true" : undefined}
                      onClick={() => {
                        setIndex(i);
                        setPaletteOpen(false);
                      }}
                      className={cn(
                        "relative flex h-10 w-full items-center justify-center rounded-sm border text-sm font-medium tabular-nums",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
                        a?.selected ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white" : "border-[var(--color-line)] bg-white",
                        i === index && "ring-2 ring-[var(--color-focus)] ring-offset-1",
                      )}
                    >
                      {i + 1}
                      {a?.marked && <Bookmark aria-hidden className="absolute -right-1 -top-1 size-3.5 fill-[var(--color-accent)] text-[var(--color-accent)]" />}
                    </button>
                  </li>
                );
              })}
            </ol>
            <dl className="mt-4 space-y-1 text-xs text-[var(--color-ink)]/70">
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-3 rounded-sm bg-[var(--color-ink)]" /> <dt className="sr-only">Filled</dt>
                <dd>Answered</dd>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-3 rounded-sm border border-[var(--color-line)]" /> <dt className="sr-only">Outlined</dt>
                <dd>Not answered</dd>
              </div>
              <div className="flex items-center gap-2">
                <Bookmark aria-hidden className="size-3 fill-[var(--color-accent)] text-[var(--color-accent)]" /> <dt className="sr-only">Flag</dt>
                <dd>Marked for review</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="submit-title"
        className="m-auto w-[min(92vw,28rem)] rounded-sm border border-[var(--color-line)] bg-white p-6 shadow-xl backdrop:bg-black/40"
      >
        <h2 id="submit-title" className="font-serif text-2xl">
          Submit this test?
        </h2>
        <ul className="mt-4 space-y-1 text-sm">
          <li>
            Answered: <strong>{answeredCount}</strong> of {questions.length}
          </li>
          <li className={unansweredCount > 0 ? "text-[var(--color-danger)]" : undefined}>
            Not answered: <strong>{unansweredCount}</strong>
          </li>
          <li>
            Marked for review: <strong>{markedCount}</strong>
          </li>
        </ul>
        <p className="mt-4 text-sm text-[var(--color-ink)]/70">You can&apos;t change your answers after submitting.</p>
        {submitError && <Alert variant="error" className="mt-4">{submitError}</Alert>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()} disabled={submitting}>
            Keep working
          </Button>
          <Button type="button" onClick={() => void doSubmit()} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitting ? "Submitting..." : "Submit test"}
          </Button>
        </div>
      </dialog>

      {/* Shown when the countdown submit fails (e.g. offline) and the dialog isn't open. */}
      {submitError && remaining <= 0 && (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md">
          <Alert variant="error">{submitError} We&apos;ll keep retrying.</Alert>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: <Loader2 aria-hidden className="size-3.5 animate-spin" />, text: "Saving...", cls: "text-[var(--color-ink)]/60" },
    saved: { icon: <CheckCircle2 aria-hidden className="size-3.5" />, text: "Saved", cls: "text-[var(--color-success)]" },
    error: { icon: <WifiOff aria-hidden className="size-3.5" />, text: "Offline - retrying", cls: "text-[var(--color-danger)]" },
  } as const;
  const s = map[state];
  return (
    <span role="status" className={cn("hidden items-center gap-1.5 text-xs sm:flex", s.cls)}>
      {s.icon}
      {s.text}
    </span>
  );
}
