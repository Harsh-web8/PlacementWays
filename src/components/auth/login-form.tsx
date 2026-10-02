"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/server/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { Alert } from "@/components/ui/alert";
import { FormField, PasswordField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}

      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <div className="space-y-2">
        <PasswordField
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm underline underline-offset-4 decoration-[var(--color-accent)]">
            Forgot password?
          </Link>
        </div>
      </div>

      <SubmitButton className="w-full" pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
