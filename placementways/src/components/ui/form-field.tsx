"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { Select, type SelectProps } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = Omit<InputProps, "id"> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
};

/** Label + input + hint + error, wired together for screen readers. */
export function FormField({ name, label, errors, hint, className, ...props }: FormFieldProps) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = !!errors?.length;
  const describedBy = [props["aria-describedby"]?.trim(), hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input {...props} id={id} name={name} aria-invalid={hasError || undefined} aria-describedby={describedBy} className={className} />
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-[var(--color-ink)]/65">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-sm text-[var(--color-danger)]">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

/** Password input with a show/hide toggle (helpful on phone keyboards). */
export function PasswordField({ name, label, errors, hint, className, ...props }: Omit<FormFieldProps, "type">) {
  const id = React.useId();
  const [visible, setVisible] = React.useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = !!errors?.length;
  const describedBy = [props["aria-describedby"]?.trim(), hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          {...props}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cn(className, "pr-11")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--color-ink)]/65 hover:text-[var(--color-ink)]"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-[var(--color-ink)]/65">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-sm text-[var(--color-danger)]">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

type TextareaFieldProps = Omit<TextareaProps, "id"> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
};

/** Same label + hint + error wiring as FormField, for multi-line text. */
export function TextareaField({ name, label, errors, hint, className, ...props }: TextareaFieldProps) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = !!errors?.length;
  const describedBy = [props["aria-describedby"]?.trim(), hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea {...props} id={id} name={name} aria-invalid={hasError || undefined} aria-describedby={describedBy} className={className} />
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-[var(--color-ink)]/65">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-sm text-[var(--color-danger)]">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

type SelectFieldProps = Omit<SelectProps, "id"> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
};

/** Same label + hint + error wiring as FormField, for a native <select>. */
export function SelectField({ name, label, errors, hint, className, children, ...props }: SelectFieldProps) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = !!errors?.length;
  const describedBy = [props["aria-describedby"]?.trim(), hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select {...props} id={id} name={name} aria-invalid={hasError || undefined} aria-describedby={describedBy} className={className}>
        {children}
      </Select>
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-[var(--color-ink)]/65">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-sm text-[var(--color-danger)]">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}
