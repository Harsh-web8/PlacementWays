import { z } from "zod";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(100, "Name must be 100 characters or fewer."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a URL slug.")
    .max(100, "Slug must be 100 characters or fewer.")
    .regex(SLUG_RE, "Use lowercase letters, numbers and hyphens only, e.g. time-and-work."),
  description: optionalText(500, "Description"),
  // "" means top-level (no parent).
  parentId: z.union([z.uuid("Choose a valid parent category."), z.literal("")]),
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/, "Enter a whole number.")
    .transform((v) => (v === "" ? 0 : Number(v))),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
