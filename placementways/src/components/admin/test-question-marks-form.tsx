"use client";

import { useActionState } from "react";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/form-state";
import { updateTestQuestionMarks } from "@/server/admin/tests/actions";
import type { AdminTestQuestion } from "@/server/admin/tests/queries";

export function TestQuestionMarksForm({ testQuestion, testId }: { testQuestion: AdminTestQuestion; testId: string }) {
  const [state, formAction] = useActionState(updateTestQuestionMarks.bind(null, testQuestion.id, testId), initialFormState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FormField
        name="marks"
        label="Marks"
        type="number"
        step="0.25"
        min={0.01}
        className="w-24"
        defaultValue={state.values?.marks ?? String(testQuestion.marks)}
        errors={state.fieldErrors?.marks}
      />
      <FormField
        name="negativeMarks"
        label="Negative marks"
        type="number"
        step="0.25"
        min={0}
        className="w-28"
        defaultValue={state.values?.negativeMarks ?? String(testQuestion.negative_marks)}
        errors={state.fieldErrors?.negativeMarks}
      />
      <SubmitButton size="sm" variant="outline" pendingText="Saving...">
        Save
      </SubmitButton>
      {state.status === "error" && state.message && <Alert variant="error" className="w-full">{state.message}</Alert>}
    </form>
  );
}
