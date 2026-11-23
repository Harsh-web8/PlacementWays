"use client";
import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
export function ActionForm({
  action,
  label,
  confirm,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  label: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="space-y-3"
    >
      {state.message && (
        <Alert variant={state.status === "error" ? "error" : "success"}>
          {state.message}
        </Alert>
      )}
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}
