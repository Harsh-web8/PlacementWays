import { z } from "zod";
import { slugify } from "@/lib/utils";
import { QUESTION_TYPES, DIFFICULTIES } from "@/lib/validation/question";

type CsvOptionKey = "A" | "B" | "C" | "D";
const CSV_OPTION_KEYS: readonly CsvOptionKey[] = ["A", "B", "C", "D"];

/** Recognised header spellings (case/spacing/punctuation-insensitive) -> canonical field name. */
const HEADER_ALIASES: Record<string, string> = {
  question: "questionText",
  questiontext: "questionText",
  questiontype: "questionType",
  type: "questionType",
  category: "category",
  difficulty: "difficulty",
  optiona: "optionA",
  optionb: "optionB",
  optionc: "optionC",
  optiond: "optionD",
  correctanswer: "correctAnswer",
  answer: "correctAnswer",
  explanation: "explanation",
  marks: "marks",
  negativemarks: "negativeMarks",
  tags: "tags",
};

const REQUIRED_CANONICAL_FIELDS = ["questionText", "category"] as const;

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/** Maps a CSV header row to canonical field names (or null for an unrecognised column). */
export function mapCsvHeaders(headers: string[]): { canonical: (string | null)[]; missingRequired: string[] } {
  const canonical = headers.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);
  const missingRequired = REQUIRED_CANONICAL_FIELDS.filter((f) => !canonical.includes(f));
  return { canonical, missingRequired };
}

/** Turns one raw CSV data row into a canonical-keyed object, using the header mapping above. */
export function toCanonicalRow(canonicalHeaders: (string | null)[], rawValues: string[]): Record<string, string> {
  const row: Record<string, string> = {};
  canonicalHeaders.forEach((field, i) => {
    if (field) row[field] = rawValues[i] ?? "";
  });
  return row;
}

function normalizedEnumField<T extends readonly [string, ...string[]]>(values: T, fallback: T[number], message: string) {
  return z
    .string()
    .transform((v) => (v.trim() === "" ? fallback : v.trim().toLowerCase()))
    .pipe(z.enum(values, message));
}

function numericField(defaultValue: number, min: number, label: string) {
  return z
    .string()
    .transform((v) => (v.trim() === "" ? String(defaultValue) : v.trim()))
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, `${label} must be a positive number with up to 2 decimal places.`)
        .transform(Number)
        .refine((v) => v >= min, { message: min > 0 ? `${label} must be greater than zero.` : `${label} can't be negative.` }),
    );
}

const optionField = z.string().transform((v) => v.trim().slice(0, 1000));

export const csvRowSchema = z
  .object({
    questionText: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(1, "Question text is required.").max(5000, "Question text must be 5000 characters or fewer.")),
    questionType: normalizedEnumField(QUESTION_TYPES, "mcq", "Question type must be mcq, coding or debugging."),
    category: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(1, "Category is required.")),
    difficulty: normalizedEnumField(DIFFICULTIES, "medium", "Difficulty must be easy, easy_medium, medium, medium_hard or hard."),
    optionA: optionField,
    optionB: optionField,
    optionC: optionField,
    optionD: optionField,
    correctAnswer: z.string().transform((v) => v.trim().toUpperCase().slice(0, 1)),
    explanation: z
      .string()
      .transform((v) => v.trim())
      .transform((v) => (v === "" ? null : v.slice(0, 2000))),
    marks: numericField(1, 0.01, "Marks"),
    negativeMarks: numericField(0, 0, "Negative marks"),
    tags: z
      .string()
      .transform((v) =>
        v
          .split(";")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((val, ctx) => {
    if (val.questionType !== "mcq") return;

    const provided = CSV_OPTION_KEYS.map((k) => ({ key: k, text: val[`option${k}`] })).filter((o) => o.text !== "");

    if (provided.length < 2) {
      ctx.addIssue({ code: "custom", path: ["optionA"], message: "MCQ questions need at least two options (Option A/B/C/D)." });
    }
    if (!val.correctAnswer) {
      ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "Correct answer is required for MCQ questions." });
    } else if (!provided.some((o) => o.key === val.correctAnswer)) {
      ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "Correct answer must match one of the filled-in options (A-D)." });
    }
  });

export type CsvRowValues = z.infer<typeof csvRowSchema>;

export type CategoryRef = { id: string; slug: string; name: string };

/** Matches a CSV row's free-text category against a known category by slug first, then exact name. */
export function resolveCategoryId(categories: CategoryRef[], text: string): string | null {
  const slug = slugify(text);
  const bySlug = categories.find((c) => c.slug === slug);
  if (bySlug) return bySlug.id;
  const lower = text.trim().toLowerCase();
  const byName = categories.find((c) => c.name.trim().toLowerCase() === lower);
  return byName ? byName.id : null;
}
