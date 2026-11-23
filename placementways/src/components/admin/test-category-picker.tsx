"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/form-state";
import { setTestCategories } from "@/server/admin/tests/actions";
import type { AdminCategory } from "@/server/admin/categories/queries";

export function TestCategoryPicker({
  testId,
  categories,
  selectedIds,
}: {
  testId: string;
  categories: AdminCategory[];
  selectedIds: string[];
}) {
  const [state, formAction] = useActionState(setTestCategories.bind(null, testId), initialFormState);
  const topLevel = categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const selected = new Set(selectedIds);

  return (
    <form action={formAction} className="space-y-4">
      <div className="max-h-80 space-y-4 overflow-y-auto rounded-sm border border-[var(--color-line)] p-4">
        {topLevel.map((parent) => (
          <fieldset key={parent.id}>
            <legend className="text-sm font-medium">{parent.name}</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="categoryIds" value={parent.id} defaultChecked={selected.has(parent.id)} />
                {parent.name} (general)
              </label>
              {categories
                .filter((c) => c.parent_id === parent.id)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((child) => (
                  <label key={child.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="categoryIds" value={child.id} defaultChecked={selected.has(child.id)} />
                    {child.name}
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
      </div>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}
      <SubmitButton size="sm" pendingText="Saving...">
        Save categories
      </SubmitButton>
    </form>
  );
}
