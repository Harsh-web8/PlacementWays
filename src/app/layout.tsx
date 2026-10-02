import { getSiteUrl } from "@/lib/env";
import type { Metadata } from "next";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase:new URL(getSiteUrl()),
  robots:process.env.DEPLOYMENT_ENV === "production" ? undefined : {index:false,follow:false},
  title: {
    default: "PlacementWays",
    template: "%s | PlacementWays",
  },
  description:
    "Company-specific mock tests, coding practice, and performance insights for Indian college placements.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--color-paper)]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:"PlacementWays",url:getSiteUrl()}).replace(/</g,"\\u003c")}}/>
        {children}
      </body>
    </html>
  );
}
