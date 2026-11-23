import { LearningForm } from "@/components/admin/learning-form";
import { setPracticeVisibility } from "@/server/admin/platform/actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { getAdminQuestion } from "@/server/admin/questions/queries";
import { listAdminCategories } from "@/server/admin/categories/queries";
import { saveQuestion } from "@/server/admin/questions/actions";
import { QuestionForm } from "@/components/admin/question-form";
import { QuestionStatusActions } from "@/components/admin/question-status-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { QUESTION_TYPE_LABELS } from "@/lib/validation/question";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({ params }: PageProps<"/admin/questions/[questionId]">) {
  const { questionId } = await params;
  const data = await getAdminQuestion(questionId);
  return { title: data ? QUESTION_TYPE_LABELS[data.question.question_type] + " question" : "Question" };
}

export default async function EditQuestionPage({ params }: PageProps<"/admin/questions/[questionId]">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const { questionId } = await params;

  const [data, categories] = await Promise.all([getAdminQuestion(questionId), listAdminCategories()]);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl tracking-tight">{QUESTION_TYPE_LABELS[data.question.question_type]} question</h1>
            <StatusBadge status={data.question.status} />
          </div>
          <p className="mt-2 max-w-xl text-[var(--color-ink)]/70">{data.question.question_text}</p>
        </div>
      </div>
      <QuestionStatusActions question={data.question} />

      <section className="space-y-4"><h2 className="font-serif text-2xl">Practice publication</h2><p>Only published questions enabled here appear in public practice.</p><LearningForm action={setPracticeVisibility.bind(null,questionId)} values={{slug:data.question.slug,is_practice:String(data.question.is_practice)}} fields={[{name:"slug",label:"Public question slug"},{name:"is_practice",label:"Practice visibility",options:[{value:"false",label:"Mock tests only"},{value:"true",label:"Include in practice"}]}]}/></section>
      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
        </CardHeader>
        <CardContent>
          {data.question.question_type !== "mcq" && <Link className="mb-4 block underline" href={`/admin/questions/${questionId}/cases`}>Manage coding test cases</Link>}
          <QuestionForm existing={data} categories={categories} action={saveQuestion.bind(null, data.question.id)} />
        </CardContent>
      </Card>
    </div>
  );
}
