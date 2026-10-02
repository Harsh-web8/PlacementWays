import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AdminMockTest = Tables<"mock_tests">;
export type AdminTestQuestion = Tables<"test_questions">;

/** Every mock test, all statuses, newest first. */
export async function listAdminMockTests(): Promise<AdminMockTest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("mock_tests").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("[admin] could not list mock tests", { code: error.code });
    return [];
  }
  return data;
}

export async function getAdminMockTest(testId: string): Promise<AdminMockTest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("mock_tests").select("*").eq("id", testId).maybeSingle();
  if (error) {
    console.error("[admin] could not load mock test", { code: error.code });
    return null;
  }
  return data;
}

export type AssignedQuestion = {
  testQuestion: AdminTestQuestion;
  questionText: string;
  questionType: Tables<"questions">["question_type"];
  difficulty: Tables<"questions">["difficulty"];
  status: Tables<"questions">["status"];
};

export type MockTestWithDetails = {
  test: AdminMockTest;
  categoryIds: string[];
  questions: AssignedQuestion[];
};

/** A test plus its assigned categories and questions, fetched separately rather than via embedded joins. */
export async function getAdminMockTestWithDetails(testId: string): Promise<MockTestWithDetails | null> {
  const supabase = await createClient();

  const { data: test, error: testError } = await supabase.from("mock_tests").select("*").eq("id", testId).maybeSingle();
  if (testError) {
    console.error("[admin] could not load mock test", { code: testError.code });
    return null;
  }
  if (!test) return null;

  const [categoriesResult, testQuestionsResult] = await Promise.all([
    supabase.from("mock_test_categories").select("category_id").eq("test_id", testId),
    supabase.from("test_questions").select("*").eq("test_id", testId).order("question_order", { ascending: true }),
  ]);

  const testQuestions = testQuestionsResult.data ?? [];
  const questionIds = testQuestions.map((tq) => tq.question_id);

  let questionsById = new Map<string, Tables<"questions">>();
  if (questionIds.length > 0) {
    const { data: questions } = await supabase.from("questions").select("*").in("id", questionIds);
    questionsById = new Map((questions ?? []).map((q) => [q.id, q]));
  }

  return {
    test,
    categoryIds: (categoriesResult.data ?? []).map((c) => c.category_id),
    questions: testQuestions.map((tq) => {
      const q = questionsById.get(tq.question_id);
      return {
        testQuestion: tq,
        questionText: q?.question_text ?? "(question no longer available)",
        questionType: q?.question_type ?? "mcq",
        difficulty: q?.difficulty ?? "medium",
        status: q?.status ?? "archived",
      };
    }),
  };
}
