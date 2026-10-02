"use client";

import { useActionState } from "react";
import Link from "next/link";
import { previewImport, confirmImport } from "@/server/admin/questions/csv-import";
import { CSV_FILE_LIMIT_LABEL, initialCsvImportState, type CsvImportState } from "@/lib/csv-import-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Same useActionState across both steps: dispatch on whether the hidden csvText field is present. */
async function importFlow(_state: CsvImportState, formData: FormData): Promise<CsvImportState> {
  return formData.has("csvText") ? confirmImport(initialCsvImportState, formData) : previewImport(initialCsvImportState, formData);
}

export function CsvImportWizard() {
  const [state, formAction] = useActionState(importFlow, initialCsvImportState);

  if (state.status === "imported") {
    return (
      <Alert variant="success">
        Imported {state.importedCount} question{state.importedCount === 1 ? "" : "s"} as drafts. Review and publish them from the{" "}
        <Link href="/admin/questions" className="underline underline-offset-4">
          question list
        </Link>
        .
      </Alert>
    );
  }

  if (state.status === "previewed" && state.rows) {
    return (
      <div className="space-y-6">
        <Alert variant={state.invalidCount ? "error" : "success"}>
          {state.validCount} of {state.rows.length} row{state.rows.length === 1 ? "" : "s"} are valid.
          {state.invalidCount ? ` ${state.invalidCount} row(s) will be skipped -- fix and re-upload to include them.` : ""}
        </Alert>

        <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-sm border border-[var(--color-line)]">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Row-by-row preview of the uploaded file</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-ink)]/[0.02]">
                <th scope="col" className="px-3 py-2 font-medium">Row</th>
                <th scope="col" className="px-3 py-2 font-medium">Question</th>
                <th scope="col" className="px-3 py-2 font-medium">Category</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.rowNumber} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-3 py-2 align-top">{row.rowNumber}</td>
                  <td className="max-w-xs truncate px-3 py-2 align-top">
                    {row.questionText || <span className="italic text-[var(--color-ink)]/50">(blank)</span>}
                  </td>
                  <td className="px-3 py-2 align-top text-[var(--color-ink)]/70">{row.category}</td>
                  <td className="px-3 py-2 align-top">
                    {row.valid ? (
                      <span className="text-[var(--color-success)]">Valid</span>
                    ) : (
                      <span className="text-[var(--color-danger)]">{row.errors.join(" ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form action={formAction}>
            <input type="hidden" name="csvText" value={state.csvText ?? ""} />
            <SubmitButton pendingText="Importing...">
              Import {state.validCount} valid row{state.validCount === 1 ? "" : "s"}
            </SubmitButton>
          </form>
          <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
            Cancel and start over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">CSV file</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
        <p className="text-xs leading-5 text-[var(--color-ink)]/65">Max {CSV_FILE_LIMIT_LABEL}. Nothing is saved until you review the preview and confirm.</p>
      </div>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      <SubmitButton pendingText="Reading file...">Preview import</SubmitButton>
    </form>
  );
}
