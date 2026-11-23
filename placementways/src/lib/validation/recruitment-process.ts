import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

const optionalYear = z
  .string()
  .trim()
  .regex(/^(\d{4})?$/, "Enter a four-digit year, for example 2026.")
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (v >= 2010 && v <= 2100), {
    message: "Enter a year between 2010 and 2100.",
  });

const optionalPositiveInt = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d*$/, `${label} must be a whole number.`)
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v > 0, { message: `${label} must be greater than zero.` });

const todayIso = () => new Date().toISOString().slice(0, 10);

export const processSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title, e.g. \"2026 campus drive\".")
    .max(200, "Title must be 200 characters or fewer."),
  description: optionalText(4000, "Description"),
  hiringYear: optionalYear,
  driveName: optionalText(150, "Drive name"),
  eligibility: optionalText(2000, "Eligibility"),
  lastVerifiedOn: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date.")
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Enter a valid date." })
    .refine((v) => v === null || v <= todayIso(), { message: "Verification date can't be in the future." }),
});

export type ProcessFormValues = z.infer<typeof processSchema>;

/** Matches the `stage_type` enum in the database. */
export const STAGE_TYPES = [
  "online_assessment",
  "aptitude",
  "coding",
  "communication",
  "technical_interview",
  "managerial_interview",
  "hr_interview",
  "group_discussion",
  "other",
] as const;

export const STAGE_TYPE_LABELS: Record<(typeof STAGE_TYPES)[number], string> = {
  online_assessment: "Online assessment",
  aptitude: "Aptitude",
  coding: "Coding",
  communication: "Communication",
  technical_interview: "Technical interview",
  managerial_interview: "Managerial interview",
  hr_interview: "HR interview",
  group_discussion: "Group discussion",
  other: "Other",
};

export const stageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a stage name.")
    .max(150, "Name must be 150 characters or fewer."),
  stageType: z.enum(STAGE_TYPES, "Choose a valid stage type."),
  description: optionalText(2000, "Description"),
  // Comma-separated in the form; stored as a text[] column.
  topics: z
    .string()
    .trim()
    .max(1000, "Topics text is too long.")
    .transform((v) =>
      v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  durationMinutes: optionalPositiveInt("Duration"),
  questionCount: optionalPositiveInt("Question count"),
});

export type StageFormValues = z.infer<typeof stageSchema>;

export const sourceSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Enter a label, e.g. \"Official careers page\".")
    .max(150, "Label must be 150 characters or fewer."),
  url: z
    .string()
    .trim()
    .min(1, "Enter a URL.")
    .max(2048, "URL is too long.")
    .refine((v) => /^https?:\/\//i.test(v), { message: "URL must start with http:// or https://." }),
});

export type SourceFormValues = z.infer<typeof sourceSchema>;
