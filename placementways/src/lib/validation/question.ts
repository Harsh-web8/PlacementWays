import { z } from "zod";

export const QUESTION_TYPES = ["mcq", "coding", "debugging"] as const;
export const QUESTION_TYPE_LABELS: Record<(typeof QUESTION_TYPES)[number], string> = {
  mcq: "Multiple choice",
  coding: "Coding",
  debugging: "Debugging",
};

export const DIFFICULTIES = ["easy", "easy_medium", "medium", "medium_hard", "hard"] as const;
export const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "Easy",
  easy_medium: "Easy–Medium",
  medium: "Medium",
  medium_hard: "Medium–Hard",
  hard: "Hard",
};

export const QUESTION_STATUSES = ["draft", "published", "archived"] as const;

/** A-F: matches the `options_key_format` CHECK (`^[A-Z]$`) with a sane ceiling on choice count. */
export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const marksField = (label: string, min: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, `${label} must be a positive number with up to 2 decimal places.`)
    .transform(Number)
    .refine((v) => v >= min, { message: min > 0 ? `${label} must be greater than zero.` : `${label} can't be negative.` });

const optionShape = Object.fromEntries(OPTION_KEYS.map((k) => [`option${k}`, z.string().trim().max(1000, "An option must be 1000 characters or fewer.")])) as Record<
  `option${OptionKey}`,
  z.ZodString
>;

export const questionSchema = z
  .object({
    categoryId: z.string().trim().min(1, "Choose a category."),
    questionType: z.enum(QUESTION_TYPES, "Choose a valid question type."),
    questionText: z.string().trim().min(1, "Enter the question text.").max(5000, "Question text must be 5000 characters or fewer."),
    difficulty: z.enum(DIFFICULTIES, "Choose a valid difficulty."),
    explanation: optionalText(2000, "Explanation"),
    marks: marksField("Marks", 0.01),
    negativeMarks: marksField("Negative marks", 0),
    status: z.enum(QUESTION_STATUSES, "Choose a valid status."),
    correctAnswer: z.string().trim().max(1),
    tags: z
      .string()
      .trim()
      .max(500, "Tags text is too long.")
      .transform((v) =>
        v
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ...optionShape,
  })
  .superRefine((val, ctx) => {
    if (val.questionType !== "mcq") return;

    const provided = OPTION_KEYS.map((k) => ({ key: k, text: val[`option${k}`] })).filter((o) => o.text !== "");
    if (provided.length < 2) {
      ctx.addIssue({ code: "custom", path: ["optionA"], message: "Add at least two options for a multiple-choice question." });
    }
    if (!val.correctAnswer) {
      ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "Choose the correct answer." });
    } else if (!provided.some((o) => o.key === val.correctAnswer)) {
      ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "The correct answer must be one of the options you filled in." });
    }
  });

export type QuestionFormValues = z.infer<typeof questionSchema>;

/** Options ready for the admin_save_question RPC: only the non-empty ones, in A..F order. */
export function optionsPayload(values: QuestionFormValues): { option_key: string; option_text: string }[] {
  if (values.questionType !== "mcq") return [];
  return OPTION_KEYS.map((k) => ({ option_key: k, option_text: values[`option${k}`] })).filter((o) => o.option_text !== "");
}
