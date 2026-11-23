import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { logout } from "@/server/auth/actions";
import type { SessionUser } from "@/server/auth/session";

type NavItem = { href: string; label: string };

/** Header for signed-in areas (student and admin). Server component. */
export function AppHeader({
  user,
  nav,
  badge,
}: {
  user: SessionUser;
  nav: NavItem[];
  badge?: string;
}) {
  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Brand className="text-xl" />
          {badge && (
            <span className="rounded-full bg-[var(--color-ink)] px-2.5 py-0.5 text-xs font-medium text-white">
              {badge}
            </span>
          )}
        </div>
        <nav
          aria-label="Main"
          className="order-3 flex w-full flex-wrap gap-5 text-sm font-medium sm:order-none sm:w-auto"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="py-1 hover:opacity-60"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span
            className="hidden max-w-40 truncate text-sm text-[var(--color-ink)]/70 sm:inline"
            title={user.email}
          >
            {user.name}
          </span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
