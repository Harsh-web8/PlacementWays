"use client";
import { useActionState } from "react";
import {
  FormField,
  TextareaField,
  SelectField,
} from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";
export type LearningField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "url";
  hint?: string;
  options?: { value: string; label: string }[];
};
export function LearningForm({
  action,
  fields,
  values,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: LearningField[];
  values: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {state.message && (
        <Alert variant={state.status === "error" ? "error" : "success"}>
          {state.message}
        </Alert>
      )}
      {fields.map((f) => {
        const props = {
          name: f.name,
          label: f.label,
          hint: f.hint,
          defaultValue: state.values?.[f.name] ?? values[f.name] ?? "",
          errors: state.fieldErrors?.[f.name],
        };
        return f.options ? (
          <SelectField key={f.name} {...props}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        ) : f.type === "textarea" ? (
          <TextareaField
            key={f.name}
            {...props}
            rows={f.name === "body" ? 16 : 4}
          />
        ) : (
          <FormField key={f.name} {...props} type={f.type ?? "text"} />
        );
      })}
      <SubmitButton>Save content</SubmitButton>
    </form>
  );
}
