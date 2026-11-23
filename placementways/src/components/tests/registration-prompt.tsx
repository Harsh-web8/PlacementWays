import Link from "next/link";
import { Button } from "@/components/ui/button";
export function RegistrationPrompt({ next, result = false }: { next: string; result?: boolean }) {
  return <section className="space-y-4 rounded border border-[var(--color-line)] bg-white p-6">
    <h2 className="font-serif text-2xl">{result ? "Want to save this result and continue preparing?" : "Create your free account to continue."}</h2>
    <p>Explore more mock tests and build your preparation plan.</p>
    <ul className="list-disc pl-5 text-sm"><li>Save your test results</li><li>Track preparation progress</li><li>Access more mock tests</li><li>See performance analysis</li><li>Get personalized recommendations</li></ul>
    <div className="flex flex-wrap gap-3"><Button asChild><Link href={`/register?next=${encodeURIComponent(next)}`}>Create Free Account</Link></Button><Button asChild variant="outline"><Link href={`/login?next=${encodeURIComponent(next)}`}>Login</Link></Button></div>
  </section>;
}
