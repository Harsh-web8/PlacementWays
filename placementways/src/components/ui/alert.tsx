import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "error" | "success" | "info";

const styles: Record<Variant, string> = {
  error: "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 text-[var(--color-danger)]",
  success: "border-[var(--color-success)]/40 bg-[var(--color-success)]/5 text-[var(--color-success)]",
  info: "border-[var(--color-line)] bg-white text-[var(--color-ink)]",
};
const icons = { error: AlertCircle, success: CheckCircle2, info: Info };

/** Errors use role="alert" (announced immediately); the rest use role="status". */
export function Alert({
  variant = "info",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  const Icon = icons[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-sm border px-4 py-3 text-sm leading-6", styles[variant], className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
