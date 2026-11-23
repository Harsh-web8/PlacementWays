import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listPosts } from "@/server/blog";
import { PageHero } from "@/components/marketing/page-hero";
export const metadata = { title: "Preparation guides" };
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export default async function Page({ searchParams }: PageProps<"/blog">) {
  const sp = await searchParams;
  const page = Math.min(10000, Math.max(1, Math.floor(Number(sp.page) || 1)));
  const { posts, total } = await listPosts(page);
  const lastPage = Math.max(1, Math.ceil(total / 12));
  const btn =
    "rounded-md border border-[var(--color-line)] bg-white px-4 py-2 text-sm hover:border-[var(--color-ink)]/50";
  return (
    <div>
      <PageHero
        narrow
        title="Preparation guides"
        subtitle="Exam patterns, strategies and interview tips for Indian campus placements."
      />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10">
        {!posts.length && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center text-[var(--color-ink)]/70">
            Guides will appear here when published.
          </p>
        )}
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/blog/${p.slug}`}
                className="group block rounded-xl border border-[var(--color-line)] bg-white p-6 transition hover:border-[var(--color-ink)]/40 hover:shadow-sm"
              >
                <p className="text-xs text-[var(--color-ink)]/60">{date(p.created_at)}</p>
                <h2 className="mt-1 font-serif text-xl md:text-2xl">{p.title}</h2>
                {p.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-ink)]/75">{p.description}</p>
                )}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
                  Read guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {lastPage > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            {page > 1 ? <Link className={btn} href={`?page=${page - 1}`}>← Previous</Link> : <span />}
            <span className="text-[var(--color-ink)]/70">Page {page} of {lastPage}</span>
            {page < lastPage ? <Link className={btn} href={`?page=${page + 1}`}>Next →</Link> : <span />}
          </nav>
        )}
      </div>
    </div>
  );
}
