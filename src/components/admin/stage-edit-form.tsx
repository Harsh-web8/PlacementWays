"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/form-state";
import { StageFormFields } from "@/components/admin/stage-form-fields";
import { updateStage } from "@/server/admin/processes/actions";
import type { AdminStage } from "@/server/admin/processes/queries";

export function StageEditForm({ stage, processId, companyId }: { stage: AdminStage; processId: string; companyId: string }) {
  const [state, formAction] = useActionState(updateStage.bind(null, stage.id, processId, companyId), initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <StageFormFields stage={stage} state={state} />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      <SubmitButton size="sm" pendingText="Saving...">
        Save stage
      </SubmitButton>
    </form>
  );
}
