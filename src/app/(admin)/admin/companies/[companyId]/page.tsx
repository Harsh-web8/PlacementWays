import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { getAdminCompany } from "@/server/admin/companies/queries";
import { listProcessesForCompany } from "@/server/admin/processes/queries";
import { updateCompany } from "@/server/admin/companies/actions";
import { CompanyForm } from "@/components/admin/company-form";
import { CompanyStatusActions } from "@/components/admin/company-status-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/admin/companies/[companyId]">) {
  const { companyId } = await params;
  const company = await getAdminCompany(companyId);
  return { title: company ? company.name : "Company" };
}

export default async function EditCompanyPage({ params }: PageProps<"/admin/companies/[companyId]">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const { companyId } = await params;

  const [company, processes] = await Promise.all([getAdminCompany(companyId), listProcessesForCompany(companyId)]);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl tracking-tight">{company.name}</h1>
            <StatusBadge status={company.status} />
          </div>
          <p className="mt-2 text-[var(--color-ink)]/70">/{company.slug}</p>
        </div>
        <CompanyStatusActions company={company} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company details</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyForm company={company} action={updateCompany.bind(null, company.id)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Recruitment processes</CardTitle>
            <CardDescription>Company-specific stages, topics and source links live here.</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href={`/admin/companies/${company.id}/processes/new`}>Add process</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {processes.length === 0 ? (
            <p className="text-sm text-[var(--color-ink)]/65">No recruitment processes yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {processes.map((process) => (
                <li key={process.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">
                      {process.title}
                      {process.hiring_year ? ` (${process.hiring_year})` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-ink)]/60">
                      {process.last_verified_on
                        ? `Last verified ${new Date(process.last_verified_on).toLocaleDateString("en-IN")}`
                        : "Not yet verified"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={process.status} />
                    <Link href={`/admin/processes/${process.id}`} className="text-sm underline underline-offset-4 hover:no-underline">
                      Edit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
