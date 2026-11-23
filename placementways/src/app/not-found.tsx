import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Brand />
      <h1 className="mt-6 font-serif text-5xl tracking-tight">Page not found</h1>
      <p className="max-w-md text-[var(--color-ink)]/70">The page you are looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
      <Button asChild><Link href="/">Back to home</Link></Button>
    </main>
  );
}
