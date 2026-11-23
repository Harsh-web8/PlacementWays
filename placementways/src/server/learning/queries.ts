import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";

export const listCourses = cache(
  async (companyId?: string, search = "", page = 1) => {
    if (!readSupabaseEnv().ok) return { courses: [], total: 0 };
    const db = await createClient();
    let query = db
      .from("courses")
      .select(
        "id, title, slug, description, difficulty, is_free, price_paise, currency",
        { count: "exact" },
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 12, page * 12 - 1);
    if (companyId) query = query.eq("company_id", companyId);
    if (search)
      query = query.ilike("title", `%${search.replace(/[%_\\]/g, "\\$&")}%`);
    const { data, error, count } = await query;
    if (error)
      throw new Error("Courses are temporarily unavailable. Please try again.");
    return { courses: data ?? [], total: count ?? 0 };
  },
);
export const getCourse = cache(async (slug: string) => {
  if (!readSupabaseEnv().ok) return null;
  const db = await createClient();
  const { data, error } = await db
    .from("courses")
    .select(
      "id, title, slug, description, difficulty, is_free, price_paise, currency, company_id, mock_test_id",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("Course is temporarily unavailable.");
  return data;
});
export const getSyllabus = cache(async (courseId: string) => {
  const db = await createClient();
  const { data, error } = await db
    .from("course_modules")
    .select(
      "id, title, description, sort_order, lessons(id, title, slug, sort_order, duration_minutes, is_free, status)",
    )
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("sort_order")
    .order("id");
  if (error) throw new Error("Syllabus is temporarily unavailable.");
  return (data ?? []).map((m) => ({
    ...m,
    lessons: m.lessons
      .filter((l) => l.status === "published")
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
  }));
});
export async function getLessonBody(id: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("lesson_contents")
    .select("body, video_url, resource_url, private_resource_path")
    .eq("lesson_id", id)
    .maybeSingle();
  if (error) throw new Error("Lesson is temporarily unavailable.");
  return data;
}
export async function getLearningProgress(userId: string) {
  const db = await createClient();
  const [courses, lessons] = await Promise.all([
    db
      .from("course_progress")
      .select("course_id, started_at, courses(title, slug, status)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(50),
    db.from("lesson_progress").select("lesson_id").eq("user_id", userId),
  ]);
  if (courses.error || lessons.error)
    throw new Error("Learning progress is temporarily unavailable.");
  return {
    courses: courses.data ?? [],
    completed: new Set((lessons.data ?? []).map((l) => l.lesson_id)),
  };
}
