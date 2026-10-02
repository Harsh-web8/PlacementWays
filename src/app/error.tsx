"use client";

import { Button } from "@/components/ui/button";

export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-serif text-4xl tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-[var(--color-ink)]/70">An unexpected error occurred. Please try again. If it keeps happening, contact support.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
