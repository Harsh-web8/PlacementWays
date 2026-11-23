import { z } from "zod";
import { DIFFICULTIES } from "./question";
const title = z.string().trim().min(1).max(200);
const slug = z
  .string()
  .trim()
  .max(150)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use lowercase words separated by hyphens.",
  );
const optionalId = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => v || null);
const url = z
  .union([z.url({ protocol: /^https$/ }).max(2000), z.literal("")])
  .transform((v) => v || null);
const status = z.enum(["draft", "published", "archived"]);
const integer = (max: number) =>
  z
    .string()
    .regex(/^\d+$/, "Enter a whole number.")
    .transform(Number)
    .pipe(z.number().int().min(0).max(max));
const boolean = z.enum(["true", "false"]).transform((v) => v === "true");
export const courseSchema = z
  .object({
    title,
    slug,
    description: z.string().trim().max(10000),
    company_id: optionalId,
    category_id: optionalId,
    mock_test_id: optionalId,
    thumbnail_url: url,
    difficulty: z.enum(DIFFICULTIES),
    status,
    is_free: boolean,
    price_paise: integer(100000000),
  })
  .refine((v) => (v.is_free ? v.price_paise === 0 : v.price_paise > 0), {
    path: ["price_paise"],
    message:
      "Free courses must cost 0; premium courses need a positive price in paise.",
  });
export const moduleSchema = z.object({
  title,
  description: z.string().trim().max(10000),
  course_id: z.uuid(),
  sort_order: integer(1000000),
  status,
});
export const lessonSchema = z.object({
  title,
  slug,
  module_id: z.uuid(),
  category_id: optionalId,
  duration_minutes: integer(600).pipe(z.number().min(1)),
  sort_order: integer(1000000),
  is_free: boolean,
  status,
  body: z.string().trim().max(100000),
  video_url: url,
  resource_url: url,
});
