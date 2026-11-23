import Link from "next/link";
import {
  learningKind,
  listAdminLearning,
} from "@/server/admin/learning/queries";
export default async function LearningList({
  params,
  searchParams,
}: PageProps<"/admin/[learningKind]">) {
  const kind = learningKind((await params).learningKind);
  const sp = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(sp.page) || 1));
  const { rows, total } = await listAdminLearning(kind, Math.floor(page));
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl capitalize">{kind}</h1>
      <div className="flex flex-wrap gap-5">
        <Link className="underline" href={`/admin/${kind}/new`}>
          Create {kind.slice(0, -1)}
        </Link>
        {["courses", "modules", "lessons"]
          .filter((k) => k !== kind)
          .map((k) => (
            <Link className="underline" key={k} href={`/admin/${k}`}>
              Manage {k}
            </Link>
          ))}
      </div>
      <p className="text-sm">
        Publish the course, its module and its lesson to make a lesson visible.
        Archive content to preserve student progress.
      </p>
      <ul className="divide-y rounded border border-[var(--color-line)]">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between gap-4 p-4">
            <Link className="underline" href={`/admin/${kind}/${r.id}`}>
              {r.title}
            </Link>
            <span>{r.status}</span>
          </li>
        ))}
      </ul>
      {!rows.length && <p>No content on this page yet.</p>}
      <nav aria-label="Pagination" className="flex gap-5">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        {page * 25 < total && <Link href={`?page=${page + 1}`}>Next</Link>}
      </nav>
    </div>
  );
}
