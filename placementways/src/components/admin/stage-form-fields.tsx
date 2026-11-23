import { FormField, TextareaField, SelectField } from "@/components/ui/form-field";
import { STAGE_TYPES, STAGE_TYPE_LABELS } from "@/lib/validation/recruitment-process";
import type { FormState } from "@/lib/form-state";
import type { AdminStage } from "@/server/admin/processes/queries";

export function StageFormFields({ stage, state }: { stage?: AdminStage; state: FormState }) {
  const values = state.values;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="name"
          label="Stage name"
          required
          placeholder="e.g. Online assessment"
          defaultValue={values?.name ?? stage?.name ?? ""}
          errors={state.fieldErrors?.name}
        />
        <SelectField
          name="stageType"
          label="Stage type"
          defaultValue={values?.stageType ?? stage?.stage_type ?? "other"}
          errors={state.fieldErrors?.stageType}
        >
          {STAGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {STAGE_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
      </div>
      <TextareaField
        name="description"
        label="Description"
        rows={2}
        defaultValue={values?.description ?? stage?.description ?? ""}
        errors={state.fieldErrors?.description}
      />
      <FormField
        name="topics"
        label="Topics covered"
        hint="Comma-separated, e.g. Arrays, Recursion, Time complexity"
        defaultValue={values?.topics ?? stage?.topics?.join(", ") ?? ""}
        errors={state.fieldErrors?.topics}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="durationMinutes"
          label="Duration (minutes)"
          type="number"
          min={1}
          hint="Leave blank if not verified."
          defaultValue={values?.durationMinutes ?? (stage?.duration_minutes ? String(stage.duration_minutes) : "")}
          errors={state.fieldErrors?.durationMinutes}
        />
        <FormField
          name="questionCount"
          label="Number of questions"
          type="number"
          min={1}
          hint="Leave blank if not verified."
          defaultValue={values?.questionCount ?? (stage?.question_count ? String(stage.question_count) : "")}
          errors={state.fieldErrors?.questionCount}
        />
      </div>
    </div>
  );
}
