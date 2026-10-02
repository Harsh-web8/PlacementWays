import Link from "next/link";

export function Brand({ className = "text-2xl" }: { className?: string }) {
  return (
    <Link href="/" className={`font-serif font-semibold tracking-tight ${className}`} aria-label="PlacementWays home">
      Placement<span className="text-[var(--color-accent)]">Ways</span>
    </Link>
  );
}
