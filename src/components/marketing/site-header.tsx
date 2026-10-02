"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/tests", label: "Mock tests" },
  { href: "/companies", label: "Companies" },
  { href: "/courses", label: "Courses" },
  { href: "/practice", label: "Practice" },
  { href: "/coding", label: "Coding" },
  { href: "/blog", label: "Blog" },
  { href: "/#how-it-works", label: "How it works" },

];

/** Marketing-site header: logo, section nav, auth buttons, mobile menu. */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Link
          href="/"
          className="font-serif text-2xl font-semibold tracking-tight"
        >
          Placement<span className="text-[var(--color-accent)]">Ways</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-opacity hover:opacity-60"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 xl:flex">
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button variant="accent" size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
        <button
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          className="rounded-md p-2 xl:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {menuOpen && (
        <nav className="flex flex-col gap-4 border-t border-[var(--color-line)] px-6 py-5 text-sm xl:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Button variant="outline" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button variant="accent" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      )}
    </header>
  );
}
