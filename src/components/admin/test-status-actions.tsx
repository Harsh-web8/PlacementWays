import { ActionButton } from "@/components/admin/action-button";
import { setTestStatus, deleteTest } from "@/server/admin/tests/actions";
import type { AdminMockTest } from "@/server/admin/tests/queries";

const DANGER_OUTLINE = "border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5";

export function TestStatusActions({ test }: { test: AdminMockTest }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {test.status === "archived" ? (
        <ActionButton action={setTestStatus.bind(null, test.id, "draft")} variant="outline">
          Restore to draft
        </ActionButton>
      ) : test.status === "draft" ? (
        <ActionButton action={setTestStatus.bind(null, test.id, "published")} variant="accent">
          Publish
        </ActionButton>
      ) : (
        <ActionButton action={setTestStatus.bind(null, test.id, "draft")} variant="outline">
          Unpublish
        </ActionButton>
      )}

      {test.status !== "archived" && (
        <ActionButton
          action={setTestStatus.bind(null, test.id, "archived")}
          variant="outline"
          className={DANGER_OUTLINE}
          confirmMessage="Archive this mock test? It will disappear from public pages until restored."
        >
          Archive
        </ActionButton>
      )}

      <ActionButton
        action={deleteTest.bind(null, test.id)}
        variant="outline"
        className={DANGER_OUTLINE}
        confirmMessage="Delete this mock test permanently? This only works if no student has attempted it yet -- otherwise, archive it instead. This cannot be undone."
      >
        Delete
      </ActionButton>
    </div>
  );
}
