"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { questionSchema, optionsPayload } from "@/lib/validation/question";
import { requireAdmin } from "@/server/auth/session";
import { logAdminAction } from "@/server/admin/audit";
import { resolveTagIds } from "@/server/admin/tags";
import type { Enums } from "@/types/database";

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors;

function readQuestionForm(formData: FormData) {
  return {
    categoryId: field(formData, "categoryId"),
    questionType: field(formData, "questionType"),
    questionText: field(formData, "questionText"),
    difficulty: field(formData, "difficulty"),
    explanation: field(formData, "explanation"),
    marks: field(formData, "marks"),
    negativeMarks: field(formData, "negativeMarks"),
    status: field(formData, "status"),
    correctAnswer: field(formData, "correctAnswer"),
    tags: field(formData, "tags"),
    optionA: field(formData, "optionA"),
    optionB: field(formData, "optionB"),
    optionC: field(formData, "optionC"),
    optionD: field(formData, "optionD"),
    optionE: field(formData, "optionE"),
    optionF: field(formData, "optionF"),
  };
}

/** The publish gate (>=2 options for a published MCQ) raises a human-readable 23514; pass it through. */
function friendlyQuestionError(error: Pick<PostgrestError, "code" | "message"> | null): string {
  if (error?.code === "23514") return error.message || "This question isn't ready for that change yet.";
  return "We couldn't save the question. Please try again.";
}

/**
 * Create (questionId = null) or replace (questionId set) a question, its
 * options and its tag links, all atomically via admin_save_question --
 * see migration 20260926080000 for why a plain multi-table REST save can't
 * satisfy the correct-answer-must-be-a-real-option constraint on its own.
 */
export async function saveQuestion(questionId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readQuestionForm(formData);
  const parsed = questionSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();

  let tagIds: string[];
  try {
    tagIds = await resolveTagIds(supabase, parsed.data.tags);
  } catch {
    return { status: "error", message: "We couldn't save the tags for this question. Please try again.", values: raw };
  }

  const isMcq = parsed.data.questionType === "mcq";
  const { data: savedId, error } = await supabase.rpc("admin_save_question", {
    p_question_id: questionId,
    p_category_id: parsed.data.categoryId,
    p_question_type: parsed.data.questionType,
    p_question_text: parsed.data.questionText,
    p_difficulty: parsed.data.difficulty,
    p_explanation: parsed.data.explanation,
    p_correct_answer: isMcq ? parsed.data.correctAnswer : null,
    p_marks: parsed.data.marks,
    p_negative_marks: parsed.data.negativeMarks,
    p_status: parsed.data.status,
    p_options: optionsPayload(parsed.data),
    p_tag_ids: tagIds,
  });

  if (error || !savedId) {
    console.error("[admin] could not save question", { code: error?.code });
    return { status: "error", message: friendlyQuestionError(error), values: raw };
  }

  await logAdminAction(supabase, admin.id, questionId ? "question.update" : "question.create", "question", savedId, {
    questionType: parsed.data.questionType,
  });
  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${savedId}`);

  if (!questionId) redirect(`/admin/questions/${savedId}`);
  return { status: "success", message: "Question saved.", values: raw };
}

const STATUSES: readonly Enums<"content_status">[] = ["draft", "published", "archived"];

export async function setQuestionStatus(
  questionId: string,
  status: Enums<"content_status">,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  if (!STATUSES.includes(status)) return { status: "error", message: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("questions").update({ status }).eq("id", questionId);
  if (error) {
    console.error("[admin] could not update question status", { code: error.code });
    return { status: "error", message: friendlyQuestionError(error) };
  }

  await logAdminAction(supabase, admin.id, `question.${status}`, "question", questionId);
  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${questionId}`);
  return { status: "success" };
}
