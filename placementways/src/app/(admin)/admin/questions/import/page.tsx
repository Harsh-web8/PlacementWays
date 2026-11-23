import { requireAdmin } from "@/server/auth/session";
import { CsvImportWizard } from "@/components/admin/csv-import-wizard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Import questions" };

const COLUMNS: { name: string; required: boolean; note: string }[] = [
  { name: "Question", required: true, note: "The question text." },
  { name: "Category", required: true, note: "An existing category name or slug, e.g. \u201cPercentages\u201d or \u201cpercentages\u201d." },
  { name: "Question type", required: false, note: "mcq, coding or debugging. Defaults to mcq." },
  { name: "Difficulty", required: false, note: "easy, easy_medium, medium, medium_hard or hard. Defaults to medium." },
  { name: "Option A/B/C/D", required: false, note: "Required (at least two) for mcq rows." },
  { name: "Correct answer", required: false, note: "A, B, C or D. Required for mcq rows." },
  { name: "Explanation", required: false, note: "Shown to students after they submit a test." },
  { name: "Marks", required: false, note: "Defaults to 1." },
  { name: "Negative marks", required: false, note: "Defaults to 0." },
  { name: "Tags", required: false, note: "Semicolon-separated, e.g. \u201carrays;sorting\u201d." },
];

export default async function ImportQuestionsPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Import questions from CSV</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Every imported question is saved as a <strong>draft</strong> -- review and publish them from the question list afterward.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Column reference</CardTitle>
          <CardDescription>Header names are matched case- and spacing-insensitively.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-ink)]/70">
                  <th scope="col" className="py-2 pr-4 font-medium">Column</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Required</th>
                  <th scope="col" className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((c) => (
                  <tr key={c.name} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4">{c.required ? "Yes" : "No"}</td>
                    <td className="py-2 text-[var(--color-ink)]/70">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <CsvImportWizard />
        </CardContent>
      </Card>
    </div>
  );
}
