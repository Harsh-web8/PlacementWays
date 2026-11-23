import { z } from "zod";

/** Matches the `companies_slug_format` CHECK constraint in the database. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

/** Empty string -> null; otherwise must be an http(s) URL (matches the DB CHECK). */
const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `${label} is too long.`)
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^https?:\/\//i.test(v), {
      message: `${label} must start with http:// or https://.`,
    });

export const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a company name.")
    .max(120, "Name must be 120 characters or fewer."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a URL slug.")
    .max(120, "Slug must be 120 characters or fewer.")
    .regex(SLUG_RE, "Use lowercase letters, numbers and hyphens only, e.g. tcs-nqt."),
  description: optionalText(2000, "Description"),
  logoUrl: optionalUrl("Logo URL"),
  websiteUrl: optionalUrl("Website URL"),
  seoTitle: optionalText(70, "SEO title"),
  seoDescription: optionalText(200, "SEO description"),
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/, "Enter a whole number.")
    .transform((v) => (v === "" ? 0 : Number(v))),
});

export type CompanyFormValues = z.infer<typeof companySchema>;
