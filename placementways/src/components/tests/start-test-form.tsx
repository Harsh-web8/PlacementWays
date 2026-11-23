"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";

export function StartTestForm({
  action,
  resuming,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  resuming: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction}>
      <SubmitButton size="lg" pendingText={resuming ? "Resuming..." : "Starting..."}>
        {resuming ? "Resume test" : "Start test"}
      </SubmitButton>
      {state.status === "error" && state.message && <Alert variant="error" className="mt-4">{state.message}</Alert>}
    </form>
  );
}
