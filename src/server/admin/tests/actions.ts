"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { mockTestSchema, testQuestionMarksSchema } from "@/lib/validation/mock-test";
import { requireAdmin } from "@/server/auth/session";
import { logAdminAction } from "@/server/admin/audit";
import type { Enums } from "@/types/database";

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors;

type TestStatus = Enums<"content_status">;
const TEST_STATUSES: readonly TestStatus[] = ["draft", "published", "archived"];

/** The "needs at least one question before publishing" trigger (23514) already writes a human-readable message. */
function friendlyTestError(error: Pick<PostgrestError, "code" | "message"> | null): string {
  if (error?.code === "23514") return error.message || "This test isn't ready for that change yet.";
  return "We couldn't save that change. Please try again.";
}

function revalidateTest(testId: string) {
  revalidatePath("/admin/tests");
  revalidatePath(`/admin/tests/${testId}`);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------- test --

function readTestForm(formData: FormData) {
  return {
    title: field(formData, "title"),
    slug: field(formData, "slug"),
    description: field(formData, "description"),
    instructions: field(formData, "instructions"),
    durationMinutes: field(formData, "durationMinutes"),
    difficulty: field(formData, "difficulty"),
    isFree: field(formData, "isFree") || "true",
    companyId: field(formData, "companyId"),
    accessType: field(formData, "accessType") || "GUEST_FREE",
    guestAttemptAllowed: field(formData, "guestAttemptAllowed") || "false",
    guestAttemptLimit: field(formData, "guestAttemptLimit") || "1",
    authenticatedAttemptLimit: field(formData, "authenticatedAttemptLimit"),
    pricePaise: field(formData, "pricePaise") || "0",
  };
}

export async function createTest(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readTestForm(formData);
  const parsed = mockTestSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mock_tests")
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description,
      instructions: parsed.data.instructions,
      duration_minutes: parsed.data.durationMinutes,
      difficulty: parsed.data.difficulty,
      is_free: parsed.data.accessType !== "PREMIUM",
      access_type: parsed.data.accessType,
      guest_attempt_allowed: parsed.data.guestAttemptAllowed,
      guest_attempt_limit: parsed.data.guestAttemptLimit,
      authenticated_attempt_limit: parsed.data.authenticatedAttemptLimit,
      price_paise: parsed.data.pricePaise,
      company_id: parsed.data.companyId || null,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { status: "error", message: "A mock test with that slug already exists.", values: raw };
    }
    console.error("[admin] could not create mock test", { code: error?.code });
    return { status: "error", message: "We couldn't create the mock test. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "test.create", "mock_test", data.id, { title: parsed.data.title });
  revalidateTest(data.id);
  redirect(`/admin/tests/${data.id}`);
}

export async function updateTest(testId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readTestForm(formData);
  const parsed = mockTestSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mock_tests")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description,
      instructions: parsed.data.instructions,
      duration_minutes: parsed.data.durationMinutes,
      difficulty: parsed.data.difficulty,
      is_free: parsed.data.accessType !== "PREMIUM",
      access_type: parsed.data.accessType,
      guest_attempt_allowed: parsed.data.guestAttemptAllowed,
      guest_attempt_limit: parsed.data.guestAttemptLimit,
      authenticated_attempt_limit: parsed.data.authenticatedAttemptLimit,
      price_paise: parsed.data.pricePaise,
      company_id: parsed.data.companyId || null,
    })
    .eq("id", testId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error?.code === "23505") {
      return { status: "error", message: "A mock test with that slug already exists.", values: raw };
    }
    console.error("[admin] could not update mock test", { code: error?.code });
    return { status: "error", message: "We couldn't save the mock test. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "test.update", "mock_test", testId, { title: parsed.data.title });
  revalidateTest(testId);
  return { status: "success", message: "Mock test saved.", values: raw };
}

export async function setTestStatus(testId: string, status: TestStatus, _prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!TEST_STATUSES.includes(status)) return { status: "error", message: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("mock_tests").update({ status }).eq("id", testId);
  if (error) {
    console.error("[admin] could not update test status", { code: error.code });
    return { status: "error", message: friendlyTestError(error) };
  }

  await logAdminAction(supabase, admin.id, `test.${status}`, "mock_test", testId);
  revalidateTest(testId);
  return { status: "success" };
}

export async function deleteTest(testId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("mock_tests").delete().eq("id", testId);
  if (error) {
    if (error.code === "23503") {
      return {
        status: "error",
        message: "This test can't be deleted -- students have already attempted it. Archive it instead to hide it from public pages.",
      };
    }
    console.error("[admin] could not delete mock test", { code: error.code });
    return { status: "error", message: "We couldn't delete this test. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "test.delete", "mock_test", testId);
  revalidatePath("/admin/tests");
  revalidatePath("/", "layout");
  redirect("/admin/tests");
}

/** Replace assignments atomically so an invalid category cannot erase the previous set. */
export async function setTestCategories(testId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const categoryIds = [...new Set(formData.getAll("categoryIds").filter((v): v is string => typeof v === "string" && v.length > 0))];

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_test_categories", {
    p_test_id: testId,
    p_category_ids: categoryIds,
  });
  if (error) {
    console.error("[admin] could not save test categories", { code: error.code });
    return { status: "error", message: "We couldn't save the categories. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "test.categories.update", "mock_test", testId, { count: categoryIds.length });
  revalidateTest(testId);
  return { status: "success", message: "Categories saved." };
}

// ---------------------------------------------------------- test question --

export async function addTestQuestion(testId: string, questionId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: question, error: questionError }, { data: existing, error: countError }] = await Promise.all([
    supabase.from("questions").select("marks, negative_marks").eq("id", questionId).maybeSingle(),
    supabase.from("test_questions").select("question_order").eq("test_id", testId).order("question_order", { ascending: false }).limit(1),
  ]);

  if (questionError || !question) {
    return { status: "error", message: "That question could not be found." };
  }
  if (countError) {
    console.error("[admin] could not read existing test questions", { code: countError.code });
    return { status: "error", message: "We couldn't add that question. Please try again." };
  }

  const nextOrder = (existing[0]?.question_order ?? 0) + 1;
  const { error } = await supabase.from("test_questions").insert({
    test_id: testId,
    question_id: questionId,
    question_order: nextOrder,
    marks: question.marks,
    negative_marks: question.negative_marks,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "That question is already part of this test." };
    }
    console.error("[admin] could not add test question", { code: error.code });
    return { status: "error", message: "We couldn't add that question. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "test.question.add", "mock_test", testId, { questionId });
  revalidateTest(testId);
  revalidatePath(`/admin/tests/${testId}/add-questions`);
  return { status: "success" };
}

export async function removeTestQuestion(testQuestionId: string, testId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("test_questions").delete().eq("id", testQuestionId);
  if (error) {
    console.error("[admin] could not remove test question", { code: error.code });
    return { status: "error", message: "We couldn't remove that question. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "test.question.remove", "mock_test", testId, { testQuestionId });
  revalidateTest(testId);
  return { status: "success" };
}

export async function moveTestQuestion(
  testQuestionId: string,
  testId: string,
  direction: "up" | "down",
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_test_question", { p_test_question_id: testQuestionId, p_direction: direction });
  if (error) {
    console.error("[admin] could not reorder test question", { code: error.code });
    return { status: "error", message: "We couldn't reorder that question. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "test.question.reorder", "mock_test", testId, { direction });
  revalidateTest(testId);
  return { status: "success" };
}

export async function updateTestQuestionMarks(
  testQuestionId: string,
  testId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = { marks: field(formData, "marks"), negativeMarks: field(formData, "negativeMarks") };
  const parsed = testQuestionMarksSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("test_questions")
    .update({ marks: parsed.data.marks, negative_marks: parsed.data.negativeMarks })
    .eq("id", testQuestionId);

  if (error) {
    console.error("[admin] could not update test question marks", { code: error.code });
    return { status: "error", message: "We couldn't save those marks. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "test.question.marks", "mock_test", testId, { testQuestionId });
  revalidateTest(testId);
  return { status: "success", message: "Marks saved.", values: raw };
}
