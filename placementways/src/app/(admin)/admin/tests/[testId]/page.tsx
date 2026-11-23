import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { getAdminMockTestWithDetails } from "@/server/admin/tests/queries";
import { listAdminCompanies } from "@/server/admin/companies/queries";
import { listAdminCategories } from "@/server/admin/categories/queries";
import { updateTest } from "@/server/admin/tests/actions";
import { MockTestForm } from "@/components/admin/mock-test-form";
import { TestStatusActions } from "@/components/admin/test-status-actions";
import { TestCategoryPicker } from "@/components/admin/test-category-picker";
import { TestQuestionList } from "@/components/admin/test-question-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export async function generateMetadata({ params }: PageProps<"/admin/tests/[testId]">) {
  const { testId } = await params;
  const data = await getAdminMockTestWithDetails(testId);
  return { title: data ? data.test.title : "Mock test" };
}

export default async function EditTestPage({ params }: PageProps<"/admin/tests/[testId]">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const { testId } = await params;

  const [data, companies, categories] = await Promise.all([
    getAdminMockTestWithDetails(testId),
    listAdminCompanies(),
    listAdminCategories(),
  ]);
  if (!data) notFound();
  const { test, categoryIds, questions } = data;
  const db = await createClient();
  const [total, guest, authenticated] = await Promise.all([
    db.from("test_attempts").select("id", {count:"exact", head:true}).eq("test_id",testId),
    db.from("test_attempts").select("id", {count:"exact", head:true}).eq("test_id",testId).not("guest_id","is",null),
    db.from("test_attempts").select("id", {count:"exact", head:true}).eq("test_id",testId).is("guest_id",null),
  ]);
  if (total.error || guest.error || authenticated.error) throw new Error("Could not load attempt totals.");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl tracking-tight">{test.title}</h1>
            <StatusBadge status={test.status} />
          </div>
          <p className="mt-2 text-[var(--color-ink)]/70">
            {questions.length} question{questions.length === 1 ? "" : "s"} &middot; {test.duration_minutes} minutes
          </p>
        </div>
      </div>
      <p>Total attempts: {total.count} · Started as guest: {guest.count} · Started with an account: {authenticated.count}</p>
      <TestStatusActions test={test} />

      <Card>
        <CardHeader>
          <CardTitle>Test details</CardTitle>
        </CardHeader>
        <CardContent>
          <MockTestForm test={test} companies={companies} action={updateTest.bind(null, test.id)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Used for filtering on the public test-listing page.</CardDescription>
        </CardHeader>
        <CardContent>
          <TestCategoryPicker testId={test.id} categories={categories} selectedIds={categoryIds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>Marks shown here are a snapshot for this test -- editing a question later won&apos;t change them.</CardDescription>
        </CardHeader>
        <CardContent>
          <TestQuestionList questions={questions} testId={test.id} />
        </CardContent>
      </Card>
    </div>
  );
}
