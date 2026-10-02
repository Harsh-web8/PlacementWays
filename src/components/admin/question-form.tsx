"use client";

import { useActionState, useState } from "react";
import { FormField, TextareaField, SelectField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/form-state";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  QUESTION_STATUSES,
  OPTION_KEYS,
} from "@/lib/validation/question";
import type { AdminCategory } from "@/server/admin/categories/queries";
import type { QuestionWithDetails } from "@/server/admin/questions/queries";

function categoryLabel(category: AdminCategory): string {
  return category.parent_id ? `\u2014 ${category.name}` : category.name;
}

export function QuestionForm({
  existing,
  categories,
  action,
}: {
  existing?: QuestionWithDetails;
  categories: AdminCategory[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values;
  const [questionType, setQuestionType] = useState(values?.questionType ?? existing?.question.question_type ?? "mcq");
  const isMcq = questionType === "mcq";

  const optionDefaults = OPTION_KEYS.map((k) => {
    const existingOption = existing?.options.find((o) => o.option_key === k);
    return values?.[`option${k}`] ?? existingOption?.option_text ?? "";
  });

  // Each top-level category immediately followed by its own children, both sorted by sort_order.
  const topLevel = [...categories].filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const sortedCategories = topLevel.flatMap((parent) => [
    parent,
    ...categories.filter((c) => c.parent_id === parent.id).sort((a, b) => a.sort_order - b.sort_order),
  ]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          name="categoryId"
          label="Category"
          required
          defaultValue={values?.categoryId ?? existing?.question.category_id ?? ""}
          errors={state.fieldErrors?.categoryId}
        >
          <option value="" disabled>
            Choose a category
          </option>
          {sortedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(c)}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="questionType"
          label="Question type"
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value)}
          errors={state.fieldErrors?.questionType}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
      </div>

      <TextareaField
        name="questionText"
        label="Question text"
        required
        rows={4}
        defaultValue={values?.questionText ?? existing?.question.question_text ?? ""}
        errors={state.fieldErrors?.questionText}
      />

      {isMcq && (
        <div className="space-y-4 rounded-sm border border-[var(--color-line)] p-4">
          <h3 className="font-medium">Options</h3>
          <p className="text-sm text-[var(--color-ink)]/65">Fill in at least two, then choose the correct answer below.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {OPTION_KEYS.map((k, i) => (
              <FormField
                key={k}
                name={`option${k}`}
                label={`Option ${k}`}
                defaultValue={optionDefaults[i]}
                errors={i === 0 ? state.fieldErrors?.optionA : undefined}
              />
            ))}
          </div>
          <SelectField
            name="correctAnswer"
            label="Correct answer"
            defaultValue={values?.correctAnswer ?? existing?.question.correct_answer ?? ""}
            errors={state.fieldErrors?.correctAnswer}
          >
            <option value="">Choose the correct option</option>
            {OPTION_KEYS.map((k) => (
              <option key={k} value={k}>
                Option {k}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          name="difficulty"
          label="Difficulty"
          defaultValue={values?.difficulty ?? existing?.question.difficulty ?? "medium"}
          errors={state.fieldErrors?.difficulty}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="status"
          label="Status"
          defaultValue={values?.status ?? existing?.question.status ?? "draft"}
          errors={state.fieldErrors?.status}
          hint={isMcq ? "Publishing needs at least two options and a correct answer (checked above)." : undefined}
        >
          {QUESTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          name="marks"
          label="Marks"
          type="number"
          step="0.25"
          min={0.01}
          defaultValue={values?.marks ?? String(existing?.question.marks ?? 1)}
          errors={state.fieldErrors?.marks}
        />
        <FormField
          name="negativeMarks"
          label="Negative marks"
          type="number"
          step="0.25"
          min={0}
          hint="Deducted for a wrong answer. 0 for no negative marking."
          defaultValue={values?.negativeMarks ?? String(existing?.question.negative_marks ?? 0)}
          errors={state.fieldErrors?.negativeMarks}
        />
      </div>

      <TextareaField
        name="explanation"
        label="Explanation"
        rows={3}
        hint="Shown to students after they submit a test."
        defaultValue={values?.explanation ?? existing?.question.explanation ?? ""}
        errors={state.fieldErrors?.explanation}
      />
      <FormField
        name="tags"
        label="Tags"
        hint="Comma-separated, e.g. arrays, two-pointers"
        defaultValue={values?.tags ?? existing?.tagNames.join(", ") ?? ""}
        errors={state.fieldErrors?.tags}
      />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <SubmitButton pendingText="Saving...">{existing ? "Save changes" : "Create question"}</SubmitButton>
    </form>
  );
}
