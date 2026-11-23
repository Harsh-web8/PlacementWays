import type { ReactNode } from "react";

/** Shared dark page header used across the public listing pages. */
export function PageHero({
  title,
  subtitle,
  eyebrow,
  children,
  narrow = false,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <section className="bg-[var(--color-ink)] text-white">
      <div className={`mx-auto w-full px-6 py-12 md:py-14 ${narrow ? "max-w-4xl" : "max-w-6xl"}`}>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-serif text-3xl md:text-5xl">{title}</h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-white/80 md:text-lg">{subtitle}</p>
        )}
        {children}
      </div>
    </section>
  );
}
