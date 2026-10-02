"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import {
  courseSchema,
  moduleSchema,
  lessonSchema,
} from "@/lib/validation/learning";
import { requireAdmin } from "@/server/auth/session";
import { logAdminAction } from "@/server/admin/audit";

const schemas = {
  courses: courseSchema,
  modules: moduleSchema,
  lessons: lessonSchema,
};
type Kind = keyof typeof schemas;
function refresh() {
  revalidatePath("/", "layout");
}
export async function saveLearning(
  kind: Kind,
  id: string | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  if (
    !Object.hasOwn(schemas, kind) ||
    (id !== null && !z.uuid().safeParse(id).success)
  )
    return { status: "error", message: "Invalid content reference." };
  const raw = Object.fromEntries(
    Object.keys(schemas[kind].shape).map((k) => [k, field(form, k)]),
  );
  const db = await createClient();
  let result: { data: { id: string } | null; error: { code?: string } | null };
  if (kind === "courses") {
    const parsed = courseSchema.safeParse(raw);
    if (!parsed.success)
      return {
        status: "error",
        values: raw,
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    result = id
      ? await db
          .from("courses")
          .update(parsed.data)
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await db.from("courses").insert(parsed.data).select("id").single();
  } else if (kind === "modules") {
    const parsed = moduleSchema.safeParse(raw);
    if (!parsed.success)
      return {
        status: "error",
        values: raw,
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    result = id
      ? await db
          .from("course_modules")
          .update(parsed.data)
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await db
          .from("course_modules")
          .insert(parsed.data)
          .select("id")
          .single();
  } else {
    const parsed = lessonSchema.safeParse(raw);
    if (!parsed.success)
      return {
        status: "error",
        values: raw,
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    const { body, video_url, resource_url, ...metadata } = parsed.data;
    const saved = await db.rpc("admin_save_lesson", {
      p_id: id,
      p_metadata: metadata,
      p_content: { body, video_url, resource_url },
    });
    result = {
      data: saved.data ? { id: saved.data } : null,
      error: saved.error,
    };
  }
  if (result.error || !result.data)
    return {
      status: "error",
      values: raw,
      message:
        result.error?.code === "23505"
          ? "That slug is already in use."
          : "Could not save. Check the linked content and try again.",
    };
  await logAdminAction(
    db,
    admin.id,
    `${kind}.${id ? "update" : "create"}`,
    kind,
    result.data.id,
  );
  refresh();
  if (!id) redirect(`/admin/${kind}/${result.data.id}`);
  return { status: "success", message: "Saved.", values: raw };
}
export async function deleteLearning(
  kind: Kind,
  id: string,
  _prev: FormState,
  _form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  if (!Object.hasOwn(schemas, kind) || !z.uuid().safeParse(id).success)
    return { status: "error", message: "Invalid content reference." };
  const db = await createClient();
  const table = kind === "modules" ? "course_modules" : kind;
  const { data, error } = await db
    .from(table)
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return {
      status: "error",
      message:
        "Could not delete. Content with children or student progress must be archived instead.",
    };
  await logAdminAction(db, admin.id, `${kind}.delete`, kind, id);
  refresh();
  redirect(`/admin/${kind}`);
}
