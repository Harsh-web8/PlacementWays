import { publicSettings } from "@/server/settings";
import Link from "next/link";
export async function SiteFooter() {
  const settings=await publicSettings();
  return (
    <footer className="border-t border-[var(--color-line)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-[var(--color-ink)]/65 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <span className="font-serif text-xl font-semibold text-[var(--color-ink)]">
            Placement<span className="text-[var(--color-accent)]">Ways</span>
          </span>
          <p className="mt-2 text-xs">
            Practice with direction. Prepare with confidence.
          </p>
        </div>
        {settings?.support_email && <a href={`mailto:${settings.support_email}`} className="underline">Contact support</a>}
        <nav aria-label="Legal" className="flex gap-4 text-xs">
          <Link href="/privacy-policy" className="underline">
            Privacy
          </Link>
          <Link href="/terms-of-service" className="underline">
            Terms
          </Link>
        </nav>
        <p className="text-xs">
          &copy; {new Date().getFullYear()} PlacementWays. Practice tools, not
          placement guarantees.
        </p>
      </div>
    </footer>
  );
}
