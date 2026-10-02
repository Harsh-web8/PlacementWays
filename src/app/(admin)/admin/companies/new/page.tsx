import { requireAdmin } from "@/server/auth/session";
import { createCompany } from "@/server/admin/companies/actions";
import { CompanyForm } from "@/components/admin/company-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Add a company" };

export default async function NewCompanyPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Add a company</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">It starts as a draft. Publish it once the details are ready.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Company details</CardTitle>
          <CardDescription>Recruitment processes, stages and sources are added after the company is created.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm action={createCompany} />
        </CardContent>
      </Card>
    </div>
  );
}
