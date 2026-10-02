import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layouts do not re-run on every client navigation, so each page ALSO calls
  // requireUser(). This one guards the shell.
  const user = await requireUser();
  return (
    <>
      <AppHeader
        user={user}
        nav={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/courses", label: "Courses" },
          { href: "/tests", label: "Mock tests" },
          { href: "/practice", label: "Practice" },
          { href: "/coding/history", label: "Coding history" },
          { href: "/progress", label: "Progress" },
          { href: "/profile", label: "Profile" },
          { href: "/orders", label: "Orders" },
          ...(user.role === "admin"
            ? [{ href: "/admin", label: "Admin" }]
            : []),
        ]}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  );
}
