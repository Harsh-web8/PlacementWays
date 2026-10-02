"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/server/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { Alert } from "@/components/ui/alert";
import { FormField, PasswordField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function RegisterForm({ next = "/dashboard" }: { next?: string }) {
  const [state, action] = useActionState(register, initialFormState);

  if (state.status === "success") {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField
        name="name"
        label="Full name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
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
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a letter and a number."
        errors={state.fieldErrors?.password}
      />
      <PasswordField
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />

      <p className="text-xs leading-5 text-[var(--color-ink)]/60">
        By creating an account, you agree to our{" "}
        <Link href="/terms-of-service" className="font-medium underline underline-offset-4 decoration-[var(--color-accent)]">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="font-medium underline underline-offset-4 decoration-[var(--color-accent)]">
          Privacy Policy
        </Link>
        .
      </p>

      <SubmitButton className="w-full" variant="accent" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
