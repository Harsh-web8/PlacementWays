"use client";

import { useActionState, useState } from "react";
import { FormField, TextareaField, SelectField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";
import { slugify } from "@/lib/utils";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/validation/question";
import type { AdminMockTest } from "@/server/admin/tests/queries";
import type { AdminCompany } from "@/server/admin/companies/queries";

export function MockTestForm({
  test,
  companies,
  action,
}: {
  test?: AdminMockTest;
  companies: AdminCompany[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [slug, setSlug] = useState(test?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!test);
  const values = state.values;
  const [previousValues, setPreviousValues] = useState(values);
  // Adopt each action response once, then let the user edit the returned slug.
  if (values !== previousValues) {
    setPreviousValues(values);
    if (values?.slug !== undefined) setSlug(values.slug);
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormField
        name="title"
        label="Title"
        required
        defaultValue={values?.title ?? test?.title ?? ""}
        errors={state.fieldErrors?.title}
        onChange={(e) => {
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />
      <FormField
        name="slug"
        label="URL slug"
        required
        hint="Lowercase letters, numbers and hyphens only."
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value);
        }}
        errors={state.fieldErrors?.slug}
      />
      <TextareaField
        name="description"
        label="Description"
        rows={3}
        defaultValue={values?.description ?? test?.description ?? ""}
        errors={state.fieldErrors?.description}
      />
      <TextareaField
        name="instructions"
        label="Instructions"
        rows={3}
        hint="Shown to students before they start the test."
        defaultValue={values?.instructions ?? test?.instructions ?? ""}
        errors={state.fieldErrors?.instructions}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          name="durationMinutes"
          label="Duration (minutes)"
          type="number"
          min={1}
          max={600}
          required
          defaultValue={values?.durationMinutes ?? String(test?.duration_minutes ?? 60)}
          errors={state.fieldErrors?.durationMinutes}
        />
        <SelectField
          name="difficulty"
          label="Difficulty"
          defaultValue={values?.difficulty ?? test?.difficulty ?? "medium"}
          errors={state.fieldErrors?.difficulty}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          name="companyId"
          label="Company"
          hint="Leave as \u201cGeneral\u201d for a topic-wise test not tied to one company."
          defaultValue={values?.companyId ?? test?.company_id ?? ""}
          errors={state.fieldErrors?.companyId}
        >
          <option value="">General (no specific company)</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField name="accessType" label="Access" defaultValue={values?.accessType ?? test?.access_type ?? "GUEST_FREE"} errors={state.fieldErrors?.accessType}>
          <option value="PUBLIC">Public</option><option value="GUEST_FREE">Guest free</option><option value="LOGIN_REQUIRED">Login required</option><option value="PREMIUM">Premium</option>
        </SelectField>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField name="guestAttemptAllowed" label="Allow guest attempts" hint="Applies to Public and Guest free mocks, within the site-wide guest allowance." defaultValue={values?.guestAttemptAllowed ?? String(test?.guest_attempt_allowed ?? true)} errors={state.fieldErrors?.guestAttemptAllowed}><option value="true">Yes</option><option value="false">No</option></SelectField>
        <FormField name="guestAttemptLimit" label="Guest attempts per visitor for this mock" type="number" min={0} max={100} defaultValue={values?.guestAttemptLimit ?? String(test?.guest_attempt_limit ?? 1)} errors={state.fieldErrors?.guestAttemptLimit} />
        <FormField name="authenticatedAttemptLimit" label="Attempts per account" hint="Leave empty for unlimited. Zero disables new attempts." type="number" min={0} max={10000} defaultValue={values?.authenticatedAttemptLimit ?? String(test?.authenticated_attempt_limit ?? "")} errors={state.fieldErrors?.authenticatedAttemptLimit} />
        <FormField name="pricePaise" label="Premium price (INR paise)" type="number" min={0} defaultValue={values?.pricePaise ?? String(test?.price_paise ?? 0)} errors={state.fieldErrors?.pricePaise} />
      </div>

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <SubmitButton pendingText="Saving...">{test ? "Save changes" : "Create mock test"}</SubmitButton>
    </form>
  );
}
