import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-sm border border-[var(--color-line)] bg-white px-3 py-2 text-sm leading-6 text-[var(--color-ink)]",
      "placeholder:text-[var(--color-ink)]/45",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-[var(--color-danger)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
