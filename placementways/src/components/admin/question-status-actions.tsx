import { ActionButton } from "@/components/admin/action-button";
import { setQuestionStatus } from "@/server/admin/questions/actions";
import type { AdminQuestion } from "@/server/admin/questions/queries";

const DANGER_OUTLINE = "border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5";

export function QuestionStatusActions({ question }: { question: AdminQuestion }) {
  if (question.status === "archived") {
    return (
      <ActionButton action={setQuestionStatus.bind(null, question.id, "draft")} variant="outline">
        Restore to draft
      </ActionButton>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {question.status === "draft" ? (
        <ActionButton action={setQuestionStatus.bind(null, question.id, "published")} variant="accent">
          Publish
        </ActionButton>
      ) : (
        <ActionButton action={setQuestionStatus.bind(null, question.id, "draft")} variant="outline">
          Unpublish
        </ActionButton>
      )}
      <ActionButton
        action={setQuestionStatus.bind(null, question.id, "archived")}
        variant="outline"
        className={DANGER_OUTLINE}
        confirmMessage="Archive this question? It will no longer be usable in mock tests until restored."
      >
        Archive
      </ActionButton>
    </div>
  );
}
