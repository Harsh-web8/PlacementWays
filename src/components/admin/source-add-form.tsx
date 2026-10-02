"use client";

import { useActionState } from "react";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/form-state";
import { addSource } from "@/server/admin/processes/actions";

export function SourceAddForm({ processId, companyId }: { processId: string; companyId: string }) {
  const [state, formAction] = useActionState(addSource.bind(null, processId, companyId), initialFormState);

  return (
    <form action={formAction} className="space-y-4 rounded-sm border border-dashed border-[var(--color-line)] p-4" noValidate>
      <h3 className="font-medium">Add a source</h3>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <FormField
          name="label"
          label="Label"
          required
          placeholder="Official careers page"
          defaultValue={state.values?.label ?? ""}
          errors={state.fieldErrors?.label}
        />
        <FormField
          name="url"
          label="URL"
          type="url"
          required
          placeholder="https://..."
          defaultValue={state.values?.url ?? ""}
          errors={state.fieldErrors?.url}
        />
      </div>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      <SubmitButton size="sm" pendingText="Adding...">
        Add source
      </SubmitButton>
    </form>
  );
}
