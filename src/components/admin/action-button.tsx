"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";
import type { ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BoundAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function ActionButton({
  action,
  children,
  confirmMessage,
  variant = "outline",
  size = "sm",
  className,
}: {
  /** A Server Action pre-bound with its target id(s), e.g. `setCompanyStatus.bind(null, company.id, "archived")`. */
  action: BoundAction;
  children: ReactNode;
  /** If set, a native confirm() must be accepted before the action runs. */
  confirmMessage?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <SubmitButton variant={variant} size={size} className={cn(className)}>
        {children}
      </SubmitButton>
      {state.status === "error" && state.message && (
        <Alert variant="error" className="mt-2">
          {state.message}
        </Alert>
      )}
    </form>
  );
}
