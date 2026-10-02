import { requireAdmin } from "@/server/auth/session";
import { listAdminCompanies } from "@/server/admin/companies/queries";
import { createTest } from "@/server/admin/tests/actions";
import { MockTestForm } from "@/components/admin/mock-test-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Add a mock test" };

export default async function NewTestPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const companies = await listAdminCompanies();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Add a mock test</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">Assign categories and questions after creating it.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Test details</CardTitle>
          <CardDescription>It stays a draft until you publish it, which needs at least one question assigned.</CardDescription>
        </CardHeader>
        <CardContent>
          <MockTestForm companies={companies} action={createTest} />
        </CardContent>
      </Card>
    </div>
  );
}
