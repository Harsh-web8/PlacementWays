import { z } from "zod";
import { DIFFICULTIES, marksField } from "@/lib/validation/question";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const mockTestSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Title must be 200 characters or fewer."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a URL slug.")
    .max(100, "Slug must be 100 characters or fewer.")
    .regex(SLUG_RE, "Use lowercase letters, numbers and hyphens only, e.g. tcs-nqt-full-mock-1."),
  description: optionalText(2000, "Description"),
  instructions: optionalText(2000, "Instructions"),
  durationMinutes: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number of minutes.")
    .transform(Number)
    .refine((v) => v >= 1 && v <= 600, { message: "Duration must be between 1 and 600 minutes." }),
  difficulty: z.enum(DIFFICULTIES, "Choose a valid difficulty."),
  // "true" / "false" from a select -- kept as strings until here so the form can round-trip cleanly.
  isFree: z.enum(["true", "false"], "Choose free or premium.").transform((v) => v === "true"),
  // "" means no specific company (a general/topic-wise test).
  companyId: z.string().trim(),
  accessType: z.enum(["PUBLIC", "GUEST_FREE", "LOGIN_REQUIRED", "PREMIUM"]).default("GUEST_FREE"),
  guestAttemptAllowed: z.enum(["true", "false"]).default("true").transform(v => v === "true"),
  guestAttemptLimit: z.string().regex(/^\d+$/).default("1").transform(Number).pipe(z.number().int().min(0).max(100)),
  authenticatedAttemptLimit: z.string().regex(/^\d*$/).default("").transform(v => v === "" ? null : Number(v)).pipe(z.number().int().min(0).max(10000).nullable()),
  pricePaise: z.string().regex(/^\d+$/).default("0").transform(Number).pipe(z.number().int().min(0).max(100000000)),
});

export type MockTestFormValues = z.infer<typeof mockTestSchema>;

/** A test's own marks/negative_marks for one assigned question -- a snapshot, editable independently of the question's own defaults. */
export const testQuestionMarksSchema = z.object({
  marks: marksField("Marks", 0.01),
  negativeMarks: marksField("Negative marks", 0),
});
