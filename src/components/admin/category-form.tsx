"use client";

import { useActionState, useState } from "react";
import { FormField, TextareaField, SelectField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";
import { slugify } from "@/lib/utils";
import type { AdminCategory } from "@/server/admin/categories/queries";

export function CategoryForm({
  category,
  parentOptions,
  action,
}: {
  category?: AdminCategory;
  /** Every other category this one is allowed to sit under (excludes itself when editing). */
  parentOptions: AdminCategory[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!category);
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
        name="name"
        label="Category name"
        required
        defaultValue={values?.name ?? category?.name ?? ""}
        errors={state.fieldErrors?.name}
        onChange={(e) => {
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />
      <FormField
        name="slug"
        label="URL slug"
        required
        hint="Lowercase letters, numbers and hyphens only, e.g. time-and-work."
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value);
        }}
        errors={state.fieldErrors?.slug}
      />
      <SelectField
        name="parentId"
        label="Parent category"
        hint="Leave as \u201cNone\u201d for a top-level category like Aptitude or Reasoning."
        defaultValue={values?.parentId ?? category?.parent_id ?? ""}
        errors={state.fieldErrors?.parentId}
      >
        <option value="">None (top-level)</option>
        {parentOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextareaField
        name="description"
        label="Description"
        rows={3}
        defaultValue={values?.description ?? category?.description ?? ""}
        errors={state.fieldErrors?.description}
      />
      <FormField
        name="sortOrder"
        label="Sort order"
        type="number"
        min={0}
        hint="Lower numbers appear first."
        defaultValue={values?.sortOrder ?? String(category?.sort_order ?? 0)}
        errors={state.fieldErrors?.sortOrder}
      />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <SubmitButton pendingText="Saving...">{category ? "Save changes" : "Create category"}</SubmitButton>
    </form>
  );
}
