"use client";
import { useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import Link from "next/link";

const navLinks = [
  { href: "/companies", label: "Companies" },
  { href: "/recruitment", label: "Recruitment updates" },
  { href: "/tests", label: "Mock tests" },
  { href: "/practice", label: "Practice" },
  { href: "/coding", label: "Coding" },
  { href: "/sql", label: "SQL Lab" },
  { href: "/courses", label: "Courses" },
];

/** Public-first navigation. Admin auth is kept separate at /admin. */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-md focus:bg-white focus:px-4 focus:py-2">Skip to main content</a>
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <Link href="/" className="shrink-0 font-serif text-2xl font-semibold tracking-tight" aria-label="PlacementWays home">Placement<span className="text-[var(--color-accent-text)]">Ways</span></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm font-medium lg:flex">
        {navLinks.map(l=><Link key={l.href} href={l.href} className="transition-opacity hover:opacity-60">{l.label}</Link>)}
      </nav>
      <Link className="hidden shrink-0 items-center gap-2 rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 lg:inline-flex" href="/tests">Start for free <ArrowRight size={15}/></Link>
      <button type="button" aria-label="Toggle navigation" aria-controls="mobile-navigation" aria-expanded={menuOpen} className="grid size-11 place-items-center rounded-md lg:hidden" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X size={22} aria-hidden/>:<Menu size={22} aria-hidden/>}</button>
    </div>
    <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!menuOpen} className="max-h-[calc(100dvh-4.25rem)] overflow-y-auto border-t border-[var(--color-line)] px-4 py-2 text-sm lg:hidden">{navLinks.map(l=><Link key={l.href} href={l.href} className="flex min-h-11 items-center rounded-md px-2 hover:bg-white" onClick={()=>setMenuOpen(false)}>{l.label}</Link>)}</nav>
  </header>;
}
