import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { StageEditForm } from "@/components/admin/stage-edit-form";
import { StageAddForm } from "@/components/admin/stage-add-form";
import { STAGE_TYPE_LABELS } from "@/lib/validation/recruitment-process";
import { moveStage, deleteStage } from "@/server/admin/processes/actions";
import type { AdminStage } from "@/server/admin/processes/queries";

export function StageList({ stages, processId, companyId }: { stages: AdminStage[]; processId: string; companyId: string }) {
  return (
    <div className="space-y-4">
      {stages.length === 0 && (
        <p className="text-sm text-[var(--color-ink)]/65">No stages yet. Add the first assessment stage below.</p>
      )}
      {stages.map((stage, index) => (
        <div key={stage.id} className="rounded-sm border border-[var(--color-line)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] bg-[var(--color-ink)]/[0.02] px-4 py-2">
            <span className="text-sm font-medium">
              Stage {index + 1} &middot; {STAGE_TYPE_LABELS[stage.stage_type]}
            </span>
            <div className="flex items-center gap-1">
              {index > 0 && (
                <ActionButton
                  action={moveStage.bind(null, stage.id, processId, companyId, "up")}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <ArrowUp aria-hidden />
                  <span className="sr-only">Move stage up</span>
                </ActionButton>
              )}
              {index < stages.length - 1 && (
                <ActionButton
                  action={moveStage.bind(null, stage.id, processId, companyId, "down")}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <ArrowDown aria-hidden />
                  <span className="sr-only">Move stage down</span>
                </ActionButton>
              )}
              <ActionButton
                action={deleteStage.bind(null, stage.id, processId, companyId)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
                confirmMessage={`Remove "${stage.name}"? This cannot be undone.`}
              >
                <Trash2 aria-hidden />
                <span className="sr-only">Delete stage</span>
              </ActionButton>
            </div>
          </div>
          <div className="p-4">
            <StageEditForm stage={stage} processId={processId} companyId={companyId} />
          </div>
        </div>
      ))}
      <StageAddForm key={stages.length} processId={processId} companyId={companyId} />
    </div>
  );
}
