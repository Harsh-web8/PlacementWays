import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { listAdminCompanies } from "@/server/admin/companies/queries";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";

export const metadata = { title: "Companies" };

export default async function AdminCompaniesPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const companies = await listAdminCompanies();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Companies</h1>
          <p className="mt-2 text-[var(--color-ink)]/70">
            {companies.length} {companies.length === 1 ? "company" : "companies"}. Admins can add more without a code change.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/companies/new">Add company</Link>
        </Button>
      </div>

      {companies.length === 0 ? (
        <p className="text-[var(--color-ink)]/70">No companies yet. Add the first one to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[var(--color-line)]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">All companies, including drafts and archived entries</caption>
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-ink)]/[0.02] text-[var(--color-ink)]/70">
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Slug</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Updated</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-3 font-medium">{company.name}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">/{company.slug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={company.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink)]/70">{new Date(company.updated_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/companies/${company.id}`} className="underline underline-offset-4 hover:no-underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
