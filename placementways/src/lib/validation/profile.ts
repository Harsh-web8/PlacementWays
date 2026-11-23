import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name (at least 2 characters).")
    .max(100, "Name must be 100 characters or fewer."),
  college: optionalText(150, "College"),
  degree: optionalText(100, "Degree"),
  graduationYear: z
    .string()
    .trim()
    .regex(/^(\d{4})?$/, "Enter a four-digit year, for example 2027.")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= 2000 && v <= 2100), {
      message: "Enter a year between 2000 and 2100.",
    }),
});
