import Link from "next/link";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { TestQuestionMarksForm } from "@/components/admin/test-question-marks-form";
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/validation/question";
import { moveTestQuestion, removeTestQuestion } from "@/server/admin/tests/actions";
import type { AssignedQuestion } from "@/server/admin/tests/queries";

export function TestQuestionList({ questions, testId }: { questions: AssignedQuestion[]; testId: string }) {
  return (
    <div className="space-y-4">
      {questions.length === 0 ? (
        <p className="text-sm text-[var(--color-ink)]/65">No questions assigned yet.</p>
      ) : (
        questions.map((aq, index) => (
          <div key={aq.testQuestion.id} className="rounded-sm border border-[var(--color-line)]">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-ink)]/[0.02] px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {index + 1}. {aq.questionText}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink)]/60">
                  <span>{QUESTION_TYPE_LABELS[aq.questionType]}</span>
                  <span>&middot;</span>
                  <span>{DIFFICULTY_LABELS[aq.difficulty]}</span>
                  <StatusBadge status={aq.status} />
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {index > 0 && (
                  <ActionButton action={moveTestQuestion.bind(null, aq.testQuestion.id, testId, "up")} variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowUp aria-hidden />
                    <span className="sr-only">Move up</span>
                  </ActionButton>
                )}
                {index < questions.length - 1 && (
                  <ActionButton action={moveTestQuestion.bind(null, aq.testQuestion.id, testId, "down")} variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowDown aria-hidden />
                    <span className="sr-only">Move down</span>
                  </ActionButton>
                )}
                <ActionButton
                  action={removeTestQuestion.bind(null, aq.testQuestion.id, testId)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
                  confirmMessage="Remove this question from the test?"
                >
                  <X aria-hidden />
                  <span className="sr-only">Remove from test</span>
                </ActionButton>
              </div>
            </div>
            <div className="p-4">
              <TestQuestionMarksForm testQuestion={aq.testQuestion} testId={testId} />
            </div>
          </div>
        ))
      )}
      <Link
        href={`/admin/tests/${testId}/add-questions`}
        className="inline-block text-sm underline underline-offset-4 hover:no-underline"
      >
        + Add questions from the bank
      </Link>
    </div>
  );
}
