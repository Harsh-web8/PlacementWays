import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-sm border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)]",
      "placeholder:text-[var(--color-ink)]/45",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-[var(--color-danger)]",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
