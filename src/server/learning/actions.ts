"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import type { FormState } from "@/lib/form-state";
export async function updateLearningProgress(
  kind: "course" | "lesson",
  id: string,
  _prev: FormState,
  _form: FormData,
): Promise<FormState> {
  await requireUser();
  if (!z.uuid().safeParse(id).success || !["course", "lesson"].includes(kind))
    return { status: "error", message: "Invalid content reference." };
  const db = await createClient();
  const { error } =
    kind === "course"
      ? await db.rpc("start_course", { p_course_id: id })
      : await db.rpc("complete_lesson", { p_lesson_id: id });
  if (error)
    return {
      status: "error",
      message:
        "We couldn't save your progress. This content may be locked or unavailable; please try again.",
    };
  revalidatePath("/", "layout");
  return {
    status: "success",
    message:
      kind === "course"
        ? "Course started. Choose a lesson below."
        : "Lesson completed.",
  };
}
