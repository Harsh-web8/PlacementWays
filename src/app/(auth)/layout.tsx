import type { Metadata } from "next";
import { Brand } from "@/components/brand";

// Account pages have no SEO value and should not be indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10 sm:py-16">
      <Brand />
      <main className="mt-8 flex w-full flex-1 justify-center">{children}</main>
    </div>
  );
}
