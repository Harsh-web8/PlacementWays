"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/form-state";
import { StageFormFields } from "@/components/admin/stage-form-fields";
import { addStage } from "@/server/admin/processes/actions";

export function StageAddForm({ processId, companyId }: { processId: string; companyId: string }) {
  const [state, formAction] = useActionState(addStage.bind(null, processId, companyId), initialFormState);

  return (
    <form action={formAction} className="space-y-4 rounded-sm border border-dashed border-[var(--color-line)] p-4" noValidate>
      <h3 className="font-medium">Add a stage</h3>
      <StageFormFields state={state} />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      <SubmitButton size="sm" pendingText="Adding...">
        Add stage
      </SubmitButton>
    </form>
  );
}
