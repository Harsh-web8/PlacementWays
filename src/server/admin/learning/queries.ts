import "server-only";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/validation/question";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { LearningField } from "@/components/admin/learning-form";
export type LearningKind = "courses" | "modules" | "lessons";
export function learningKind(value: string): LearningKind {
  if (value !== "courses" && value !== "modules" && value !== "lessons")
    notFound();
  return value;
}
export async function listAdminLearning(kind: LearningKind, page: number) {
  await requireAdmin();
  const db = await createClient();
  const { data, error, count } = await db
    .from(kind === "modules" ? "course_modules" : kind)
    .select("id, title, status", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("Could not load learning content.");
  return { rows: data ?? [], total: count ?? 0 };
}
export async function learningEditor(kind: LearningKind, id: string) {
  await requireAdmin();
  const db = await createClient();
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const values: Record<string, string> = {
    status: "draft",
    is_free: kind === "courses" ? "true" : "false",
    price_paise: "0",
    difficulty: "easy",
    sort_order: "0",
    duration_minutes: "10",
  };
  if (!isNew) {
    const { data, error } = await db
      .from(kind === "modules" ? "course_modules" : kind)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("Could not load content.");
    if (!data) notFound();
    for (const [key, value] of Object.entries(data))
      values[key] = value == null ? "" : String(value);
    if (kind === "lessons") {
      const { data: body, error: bodyError } = await db
        .from("lesson_contents")
        .select("body, video_url, resource_url")
        .eq("lesson_id", id)
        .maybeSingle();
      if (bodyError) throw new Error("Could not load lesson body.");
      for (const [key, value] of Object.entries(body ?? {}))
        values[key] = value ?? "";
    }
  }
  // These selectors are explicitly bounded. Large catalogs can be managed via
  // the searchable/paginated lists; a selected item is always retained below.
  async function options(
    table:
      | "companies"
      | "categories"
      | "courses"
      | "course_modules"
      | "mock_tests",
    column: "name" | "title",
    selected?: string,
  ) {
    const { data, error } = await db
      .from(table)
      .select(`id, ${column}`)
      .order(column)
      .limit(1000);
    if (error) throw new Error("Could not load content choices.");
    const rows = (data ?? []) as unknown as Record<string, string>[];
    if (selected && !rows.some((r) => r.id === selected)) {
      const { data: existing, error: existingError } = await db
        .from(table)
        .select(`id, ${column}`)
        .eq("id", selected)
        .maybeSingle();
      if (existingError) throw new Error("Could not load selected content.");
      if (existing) rows.push(existing as unknown as Record<string, string>);
    }
    return rows.map((r) => ({ value: r.id, label: r[column] }));
  }
  const fields: LearningField[] = [{ name: "title", label: "Title" }];
  if (kind !== "modules") fields.push({ name: "slug", label: "Slug" });
  if (kind !== "lessons")
    fields.push({
      name: "description",
      label: "Description",
      type: "textarea",
    });
  const none = { value: "", label: "None" };
  if (kind === "courses") {
    const [companies, categories, mocks] = await Promise.all([
      options("companies", "name", values.company_id),
      options("categories", "name", values.category_id),
      options("mock_tests", "title", values.mock_test_id),
    ]);
    fields.push(
      { name: "company_id", label: "Company", options: [none, ...companies] },
      {
        name: "category_id",
        label: "Category",
        options: [none, ...categories],
      },
      {
        name: "mock_test_id",
        label: "Recommended mock test",
        options: [none, ...mocks],
      },
      { name: "thumbnail_url", label: "Thumbnail URL (HTTPS)", type: "url" },
      {
        name: "difficulty",
        label: "Difficulty",
        options: DIFFICULTIES.map((x) => ({
          value: x,
          label: DIFFICULTY_LABELS[x],
        })),
      },
      {
        name: "is_free",
        label: "Access",
        options: [
          { value: "true", label: "Free" },
          { value: "false", label: "Premium" },
        ],
      },
      {
        name: "price_paise",
        label: "Price in paise (INR)",
        type: "number",
        hint: "100 paise = ₹1. Free courses must be 0. Premium sales open after payment verification is implemented.",
      },
    );
  } else {
    const parent = kind === "modules" ? "course_id" : "module_id";
    fields.push(
      {
        name: parent,
        label: kind === "modules" ? "Course" : "Module",
        options: [
          { value: "", label: "Choose parent" },
          ...(await options(
            kind === "modules" ? "courses" : "course_modules",
            "title",
            values[parent],
          )),
        ],
      },
      {
        name: "sort_order",
        label: "Order",
        type: "number",
        hint: "Lower numbers appear first. Change this value to reorder.",
      },
    );
  }
  if (kind === "lessons")
    fields.push(
      {
        name: "category_id",
        label: "Topic",
        options: [
          none,
          ...(await options("categories", "name", values.category_id)),
        ],
      },
      {
        name: "duration_minutes",
        label: "Duration in minutes",
        type: "number",
      },
      {
        name: "is_free",
        label: "Preview access",
        options: [
          { value: "false", label: "Follow course access" },
          {
            value: "true",
            label: "Free preview, including in premium courses",
          },
        ],
      },
      {
        name: "body",
        label: "Lesson content and examples",
        type: "textarea",
        hint: "Plain text; paragraphs are preserved. HTML is displayed as text.",
      },
      { name: "video_url", label: "Video URL (HTTPS)", type: "url" },
      {
        name: "resource_url",
        label: "PDF / resource URL (HTTPS)",
        type: "url",
      },
    );
  fields.push({
    name: "status",
    label: "Publication status",
    options: ["draft", "published", "archived"].map((x) => ({
      value: x,
      label: x,
    })),
  });
  return { values, fields };
}
