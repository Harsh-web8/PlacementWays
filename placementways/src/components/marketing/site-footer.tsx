import { publicSettings } from "@/server/settings";
import Link from "next/link";

const columns = [
  {
    title: "Prepare",
    links: [
      { href: "/tests", label: "Mock tests" },
      { href: "/practice", label: "Practice questions" },
      { href: "/coding", label: "Coding practice" },
      { href: "/sql", label: "SQL practice" },
      { href: "/courses", label: "Courses" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/companies", label: "Company guides" },
      { href: "/blog", label: "Preparation blog" },
      { href: "/#how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Recruitment",
    links: [
      { href: "/recruitment", label: "Latest updates" },
      { href: "/companies", label: "Company hiring guides" },
    ],
  },
];

export async function SiteFooter() {
  const settings = await publicSettings();
  return (
    <footer className="border-t border-[var(--color-line)] bg-white/50">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <span className="font-serif text-2xl font-semibold text-[var(--color-ink)]">
              Placement<span className="text-[var(--color-accent)]">Ways</span>
            </span>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--color-ink)]/65">
              Practice with direction. Prepare with confidence for company
              placements across India.
            </p>
            {settings?.support_email && (
              <a
                href={`mailto:${settings.support_email}`}
                className="mt-4 inline-block text-sm underline"
              >
                {settings.support_email}
              </a>
            )}
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-ink)]/70">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-[var(--color-ink)] hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink)]/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} PlacementWays. Practice tools, not
            placement guarantees.
          </p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy-policy" className="underline">Privacy</Link>
            <Link href="/terms-of-service" className="underline">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
