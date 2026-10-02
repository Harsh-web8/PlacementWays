import { ActionButton } from "@/components/admin/action-button";
import { setProcessStatus, deleteProcess } from "@/server/admin/processes/actions";
import type { AdminProcess } from "@/server/admin/processes/queries";

const DANGER_OUTLINE = "border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5";

export function ProcessStatusActions({ process, companyId }: { process: AdminProcess; companyId: string }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {process.status === "archived" ? (
        <ActionButton action={setProcessStatus.bind(null, process.id, companyId, "draft")} variant="outline">
          Restore to draft
        </ActionButton>
      ) : process.status === "draft" ? (
        <ActionButton action={setProcessStatus.bind(null, process.id, companyId, "published")} variant="accent">
          Publish
        </ActionButton>
      ) : (
        <ActionButton action={setProcessStatus.bind(null, process.id, companyId, "draft")} variant="outline">
          Unpublish
        </ActionButton>
      )}

      {process.status !== "archived" && (
        <ActionButton
          action={setProcessStatus.bind(null, process.id, companyId, "archived")}
          variant="outline"
          className={DANGER_OUTLINE}
          confirmMessage="Archive this recruitment process? It will disappear from public pages until restored."
        >
          Archive
        </ActionButton>
      )}

      <ActionButton
        action={deleteProcess.bind(null, process.id, companyId)}
        variant="outline"
        className={DANGER_OUTLINE}
        confirmMessage="Delete this recruitment process permanently? Its stages and source links will be deleted too. This cannot be undone."
      >
        Delete
      </ActionButton>
    </div>
  );
}
