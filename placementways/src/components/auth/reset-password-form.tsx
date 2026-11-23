"use client";

import { useActionState } from "react";
import { resetPassword } from "@/server/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { Alert } from "@/components/ui/alert";
import { PasswordField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      <PasswordField
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a letter and a number."
        errors={state.fieldErrors?.password}
      />
      <PasswordField
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton className="w-full" pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}
