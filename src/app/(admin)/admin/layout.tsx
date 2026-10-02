import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | PlacementWays" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <>
      <AppHeader
        user={user}
        badge="Admin"
        nav={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/companies", label: "Companies" },
          { href: "/admin/courses", label: "Courses" },
          { href: "/admin/modules", label: "Modules" },
          { href: "/admin/lessons", label: "Lessons" },
          { href: "/admin/categories", label: "Categories" },
          { href: "/admin/questions", label: "Questions" },
          { href: "/admin/coding", label: "Coding" },
          { href: "/admin/tests", label: "Mock tests" },
          { href: "/admin/students", label: "Students" },
          { href: "/admin/blog", label: "Blog" },
          { href: "/admin/settings", label: "Settings" },
          { href: "/admin/orders", label: "Orders" },
          { href: "/admin/activity", label: "Activity" },
          { href: "/admin/access", label: "Premium access" },
          { href: "/dashboard", label: "Student view" },
        ]}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  );
}
