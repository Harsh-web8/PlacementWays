import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AdminQuestion = Tables<"questions">;
export type AdminQuestionOption = Tables<"question_options">;

export const QUESTIONS_PAGE_SIZE = 20;

export type QuestionFilters = {
  page: number;
  categoryId?: string;
  difficulty?: string;
  status?: string;
  questionType?: string;
  search?: string;
};

export type QuestionListResult = {
  questions: AdminQuestion[];
  total: number;
  page: number;
  pageCount: number;
};

/** Paginated question list for the admin bank, newest first, with optional filters. */
export async function listAdminQuestions(filters: QuestionFilters): Promise<QuestionListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page);
  const from = (page - 1) * QUESTIONS_PAGE_SIZE;
  const to = from + QUESTIONS_PAGE_SIZE - 1;

  let query = supabase.from("questions").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id").range(from, to);

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty as AdminQuestion["difficulty"]);
  if (filters.status) query = query.eq("status", filters.status as AdminQuestion["status"]);
  if (filters.questionType) query = query.eq("question_type", filters.questionType as AdminQuestion["question_type"]);
  if (filters.search) query = query.ilike("question_text", `%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) {
    console.error("[admin] could not list questions", { code: error.code });
    return { questions: [], total: 0, page, pageCount: 1 };
  }

  const total = count ?? 0;
  return { questions: data, total, page, pageCount: Math.max(1, Math.ceil(total / QUESTIONS_PAGE_SIZE)) };
}

export type QuestionWithDetails = {
  question: AdminQuestion;
  options: AdminQuestionOption[];
  tagNames: string[];
};

export async function getAdminQuestion(questionId: string): Promise<QuestionWithDetails | null> {
  const supabase = await createClient();

  const { data: question, error: questionError } = await supabase.from("questions").select("*").eq("id", questionId).maybeSingle();
  if (questionError) {
    console.error("[admin] could not load question", { code: questionError.code });
    return null;
  }
  if (!question) return null;

  const [optionsResult, tagsResult] = await Promise.all([
    supabase.from("question_options").select("*").eq("question_id", questionId).order("option_key", { ascending: true }),
    supabase.from("question_tags").select("tag_id").eq("question_id", questionId),
  ]);

  const tagIds = (tagsResult.data ?? []).map((t) => t.tag_id);
  let tagNames: string[] = [];
  if (tagIds.length > 0) {
    const { data: tags } = await supabase.from("tags").select("name").in("id", tagIds);
    tagNames = (tags ?? []).map((t) => t.name);
  }

  return { question, options: optionsResult.data ?? [], tagNames };
}
