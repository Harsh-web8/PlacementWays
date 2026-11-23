"use client";

import { useActionState } from "react";
import { updateProfile } from "@/server/profile/actions";
import { initialFormState } from "@/lib/form-state";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";

type Initial = { name: string; college: string; degree: string; graduationYear: string };

export function ProfileForm({ initial, email }: { initial: Initial; email: string }) {
  const [state, action] = useActionState(updateProfile, initialFormState);
  const v = { ...initial, ...state.values };

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === "success" && <Alert variant="success">{state.message}</Alert>}
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField name="email" label="Email" value={email} readOnly disabled hint="Your sign-in email cannot be changed here." />
      <FormField name="name" label="Full name" autoComplete="name" required defaultValue={v.name} errors={state.fieldErrors?.name} />
      <FormField name="college" label="College" autoComplete="organization" defaultValue={v.college} errors={state.fieldErrors?.college} />
      <FormField name="degree" label="Degree" placeholder="e.g. B.Tech CSE" defaultValue={v.degree} errors={state.fieldErrors?.degree} />
      <FormField
        name="graduationYear"
        label="Graduation year"
        inputMode="numeric"
        maxLength={4}
        placeholder="e.g. 2027"
        defaultValue={v.graduationYear}
        errors={state.fieldErrors?.graduationYear}
      />
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
