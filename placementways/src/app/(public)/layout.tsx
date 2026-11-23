import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

// These are reference/legal pages, not marketing pages -- no reason to
// discourage indexing, but they also carry no company-specific claims.
export const metadata: Metadata = { robots: { index: process.env.DEPLOYMENT_ENV === "production", follow: process.env.DEPLOYMENT_ENV === "production" } };

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--color-line)] px-6 py-5 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Brand />
          <Link href="/" className="text-sm font-medium underline underline-offset-4 decoration-[var(--color-accent)]">
            Back to home
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
