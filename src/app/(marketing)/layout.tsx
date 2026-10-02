import { publicSettings } from "@/server/settings";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const settings=await publicSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {settings?.announcement && <p className="border-b bg-white px-6 py-3 text-center text-sm">{settings.announcement}</p>}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
