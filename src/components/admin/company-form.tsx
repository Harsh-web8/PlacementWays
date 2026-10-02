"use client";

import { useActionState, useState } from "react";
import { FormField, TextareaField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";
import { slugify } from "@/lib/utils";
import type { AdminCompany } from "@/server/admin/companies/queries";

export function CompanyForm({
  company,
  action,
}: {
  company?: AdminCompany;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [slug, setSlug] = useState(company?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!company);
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
        label="Company name"
        required
        defaultValue={values?.name ?? company?.name ?? ""}
        errors={state.fieldErrors?.name}
        onChange={(e) => {
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />
      <FormField
        name="slug"
        label="URL slug"
        required
        hint="Shown in the public URL, e.g. placementways.example/companies/tcs-nqt. Lowercase letters, numbers and hyphens only."
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
        rows={4}
        defaultValue={values?.description ?? company?.description ?? ""}
        errors={state.fieldErrors?.description}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          name="logoUrl"
          label="Logo URL"
          type="url"
          placeholder="https://..."
          defaultValue={values?.logoUrl ?? company?.logo_url ?? ""}
          errors={state.fieldErrors?.logoUrl}
        />
        <FormField
          name="websiteUrl"
          label="Company website"
          type="url"
          placeholder="https://..."
          defaultValue={values?.websiteUrl ?? company?.website_url ?? ""}
          errors={state.fieldErrors?.websiteUrl}
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          name="seoTitle"
          label="SEO title"
          hint="Up to 70 characters. Falls back to the company name if left blank."
          defaultValue={values?.seoTitle ?? company?.seo_title ?? ""}
          errors={state.fieldErrors?.seoTitle}
        />
        <FormField
          name="sortOrder"
          label="Sort order"
          type="number"
          min={0}
          hint="Lower numbers appear first on the companies page."
          defaultValue={values?.sortOrder ?? String(company?.sort_order ?? 0)}
          errors={state.fieldErrors?.sortOrder}
        />
      </div>
      <TextareaField
        name="seoDescription"
        label="SEO description"
        rows={2}
        hint="Up to 200 characters."
        defaultValue={values?.seoDescription ?? company?.seo_description ?? ""}
        errors={state.fieldErrors?.seoDescription}
      />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <SubmitButton pendingText="Saving...">{company ? "Save changes" : "Create company"}</SubmitButton>
    </form>
  );
}
