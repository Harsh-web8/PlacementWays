import { requireAdmin } from "@/server/auth/session";
import { listAdminCategories } from "@/server/admin/categories/queries";
import { saveQuestion } from "@/server/admin/questions/actions";
import { QuestionForm } from "@/components/admin/question-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Add a question" };

export default async function NewQuestionPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const categories = await listAdminCategories();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Add a question</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">Assign it to a mock test after saving.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm categories={categories} action={saveQuestion.bind(null, null)} />
        </CardContent>
      </Card>
    </div>
  );
}
