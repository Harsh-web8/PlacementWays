"use client";

import Link from "next/link";
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
      {state.status === "error" && /account|log in/i.test(state.message ?? "") && <p className="mt-4 flex gap-4"><Link className="underline" href="/register?next=/tests">Create Free Account</Link><Link className="underline" href="/login?next=/tests">Login</Link></p>}
    </form>
  );
}
