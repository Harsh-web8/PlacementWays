"use client";

import { useActionState } from "react";
import { FormField, TextareaField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";
import type { AdminProcess } from "@/server/admin/processes/queries";

export function ProcessForm({
  process,
  action,
}: {
  process?: AdminProcess;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormField
        name="title"
        label="Title"
        required
        hint='e.g. "2026 campus placement drive"'
        defaultValue={values?.title ?? process?.title ?? ""}
        errors={state.fieldErrors?.title}
      />
      <TextareaField
        name="description"
        label="Description"
        rows={4}
        defaultValue={values?.description ?? process?.description ?? ""}
        errors={state.fieldErrors?.description}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          name="hiringYear"
          label="Hiring year"
          type="number"
          placeholder="2026"
          defaultValue={values?.hiringYear ?? (process?.hiring_year ? String(process.hiring_year) : "")}
          errors={state.fieldErrors?.hiringYear}
        />
        <FormField
          name="driveName"
          label="Drive name"
          placeholder="e.g. NQT"
          defaultValue={values?.driveName ?? process?.drive_name ?? ""}
          errors={state.fieldErrors?.driveName}
        />
      </div>
      <TextareaField
        name="eligibility"
        label="Eligibility criteria"
        rows={3}
        defaultValue={values?.eligibility ?? process?.eligibility ?? ""}
        errors={state.fieldErrors?.eligibility}
      />
      <FormField
        name="lastVerifiedOn"
        label="Last verified on"
        type="date"
        hint="Required before this process can be published."
        defaultValue={values?.lastVerifiedOn ?? process?.last_verified_on ?? ""}
        errors={state.fieldErrors?.lastVerifiedOn}
      />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <SubmitButton pendingText="Saving...">{process ? "Save changes" : "Create process"}</SubmitButton>
    </form>
  );
}
