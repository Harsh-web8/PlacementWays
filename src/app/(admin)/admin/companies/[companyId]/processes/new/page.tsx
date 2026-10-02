import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { getAdminCompany } from "@/server/admin/companies/queries";
import { createProcess } from "@/server/admin/processes/actions";
import { ProcessForm } from "@/components/admin/process-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Add a recruitment process" };

export default async function NewProcessPage({ params }: PageProps<"/admin/companies/[companyId]/processes/new">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const { companyId } = await params;

  const company = await getAdminCompany(companyId);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm text-[var(--color-ink)]/60">{company.name}</p>
        <h1 className="font-serif text-4xl tracking-tight">Add a recruitment process</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Add stages and source links after creating it. It stays a draft until published.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Process details</CardTitle>
          <CardDescription>Companies can have several processes -- one per hiring drive or year.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProcessForm action={createProcess.bind(null, companyId)} />
        </CardContent>
      </Card>
    </div>
  );
}
