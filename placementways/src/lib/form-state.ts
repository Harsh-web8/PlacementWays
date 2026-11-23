/** Shared shape returned by every form Server Action (used with useActionState). */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Non-sensitive values echoed back so the form keeps what the user typed. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

/** Reads a form field as a string ("" if missing or not text, e.g. a file). */
export function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}
