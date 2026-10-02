import { ResourceUpload } from "@/components/admin/resource-upload";
import Link from "next/link";
import { learningKind, learningEditor } from "@/server/admin/learning/queries";
import { saveLearning, deleteLearning } from "@/server/admin/learning/actions";
import { LearningForm } from "@/components/admin/learning-form";
import { ActionForm } from "@/components/learning/action-form";
export default async function LearningEdit({
  params,
}: PageProps<"/admin/[learningKind]/[itemId]">) {
  const p = await params;
  const kind = learningKind(p.learningKind);
  const { fields, values } = await learningEditor(kind, p.itemId);
  const id = p.itemId === "new" ? null : p.itemId;
  return (
    <div className="space-y-8">
      <Link className="underline" href={`/admin/${kind}`}>
        Back to {kind}
      </Link>
      <h1 className="font-serif text-4xl">
        {id ? "Edit" : "Create"} {kind.slice(0, -1)}
      </h1>
      <LearningForm
        fields={fields}
        values={values}
        action={saveLearning.bind(null, kind, id)}
      />
      {id && kind === "lessons" && <Link className="block underline" href={`/admin/lessons/${id}/questions`}>Manage practice questions</Link>}
      {id && (
        <section className="border-t pt-6">
          <h2 className="mb-4 font-semibold">Delete content</h2>
          <ActionForm
            action={deleteLearning.bind(null, kind, id)}
            label="Delete"
            confirm="Delete this content? Content with children or saved progress cannot be deleted."
          />
        </section>
      )}
    {kind === "lessons" && id && <ResourceUpload lessonId={id}/>}
    </div>
  );
}
