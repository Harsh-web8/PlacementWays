import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-sm border border-[var(--color-line)] bg-white p-6 shadow-sm sm:p-8">
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]/70">{description}</p>}
      <div className="mt-6">{children}</div>
      {footer && <div className="mt-6 border-t border-[var(--color-line)] pt-5 text-sm text-[var(--color-ink)]/70">{footer}</div>}
    </div>
  );
}
