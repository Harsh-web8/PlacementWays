import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";

/**
 * DATA ACCESS LAYER for public mock-test pages. Everything comes from the
 * database (nothing about a test is hardcoded), and Row Level Security plus
 * the `published_mock_tests` view mean an anonymous visitor can only ever see
 * published tests and aggregate numbers -- never questions or answers.
 */

export const TESTS_PAGE_SIZE = 12;

export const DURATION_OPTIONS = [30, 60, 90, 120, 180] as const;
export const MIN_QUESTION_OPTIONS = [10, 20, 30, 50] as const;

export type TestFilters = {
  company?: string; // company slug
  category?: string; // category slug (includes its subcategories)
  difficulty?: "easy" | "easy_medium" | "medium" | "medium_hard" | "hard";
  access?: "free" | "premium";
  maxDuration?: number;
  minQuestions?: number;
  sort: "newest" | "popular";
  page: number;
};

export type PublicTest = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  companyName: string | null;
  difficulty: "easy" | "easy_medium" | "medium" | "medium_hard" | "hard";
  durationMinutes: number;
  isFree: boolean;
  questionCount: number;
  totalMarks: number;
  attemptCount: number;
  hasNegativeMarking: boolean;
};

export type TestListResult = { tests: PublicTest[]; total: number; page: number; pageCount: number };

const EMPTY: TestListResult = { tests: [], total: 0, page: 1, pageCount: 1 };

/** Companies and categories for the filter dropdowns. */
export const getFilterOptions = cache(async () => {
  if (!readSupabaseEnv().ok) return { companies: [], categories: [] };
  const supabase = await createClient();
  const [companies, categories] = await Promise.all([
    supabase.from("companies").select("slug, name").eq("status", "published").order("sort_order").order("name"),
    supabase.from("categories").select("id, slug, name, parent_id, sort_order").order("sort_order").order("name"),
  ]);
  return { companies: companies.data ?? [], categories: categories.data ?? [] };
});

export async function listPublishedTests(filters: TestFilters): Promise<TestListResult> {
  if (!readSupabaseEnv().ok) return EMPTY;
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(filters.page) || 1);

  // Resolve slug filters to ids first.
  let companyId: string | null = null;
  if (filters.company) {
    const { data } = await supabase.from("companies").select("id").eq("slug", filters.company).eq("status", "published").maybeSingle();
    if (!data) return { ...EMPTY, page };
    companyId = data.id;
  }

  let testIdsForCategory: string[] | null = null;
  if (filters.category) {
    const { categories } = await getFilterOptions();
    const selected = categories.find((c) => c.slug === filters.category);
    if (!selected) return { ...EMPTY, page };
    const categoryIds = [selected.id, ...categories.filter((c) => c.parent_id === selected.id).map((c) => c.id)];
    const { data } = await supabase.from("mock_test_categories").select("test_id").in("category_id", categoryIds);
    testIdsForCategory = [...new Set((data ?? []).map((r) => r.test_id))];
    if (testIdsForCategory.length === 0) return { ...EMPTY, page };
  }

  const from = (page - 1) * TESTS_PAGE_SIZE;
  let query = supabase.from("published_mock_tests").select("*", { count: "exact" }).range(from, from + TESTS_PAGE_SIZE - 1);

  if (companyId) query = query.eq("company_id", companyId);
  if (testIdsForCategory) query = query.in("id", testIdsForCategory);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.access) query = query.eq("is_free", filters.access === "free");
  if (filters.maxDuration) query = query.lte("duration_minutes", filters.maxDuration);
  if (filters.minQuestions) query = query.gte("question_count", filters.minQuestions);

  query =
    filters.sort === "popular"
      ? query.order("attempt_count", { ascending: false }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });

  const { data, error, count } = await query;
  if (error || !data) {
    console.error("[tests] could not list published tests", { code: error?.code });
    return { ...EMPTY, page };
  }

  const companyIds = [...new Set(data.map((t) => t.company_id).filter((id): id is string => !!id))];
  const companyNames = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
    for (const c of companies ?? []) companyNames.set(c.id, c.name);
  }

  const total = count ?? 0;
  return {
    tests: data.map((t) => ({
      id: t.id ?? "",
      slug: t.slug ?? "",
      title: t.title ?? "",
      description: t.description,
      companyName: t.company_id ? (companyNames.get(t.company_id) ?? null) : null,
      difficulty: t.difficulty ?? "medium",
      durationMinutes: t.duration_minutes ?? 0,
      isFree: t.is_free ?? true,
      questionCount: t.question_count ?? 0,
      totalMarks: Number(t.total_marks ?? 0),
      attemptCount: t.attempt_count ?? 0,
      hasNegativeMarking: t.has_negative_marking ?? false,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / TESTS_PAGE_SIZE)),
  };
}

export type PublicTestDetail = PublicTest & {
  pricePaise: number;
  instructions: string | null;
  companySlug: string | null;
  topics: string[];
};

/** One published test by slug, with what the instructions page needs. Null if it doesn't exist or isn't published. */
export const getPublishedTestBySlug = cache(async (slug: string): Promise<PublicTestDetail | null> => {
  if (!readSupabaseEnv().ok) return null;
  const supabase = await createClient();

  const { data: test } = await supabase
    .from("mock_tests")
    .select("id, title, slug, description, instructions, difficulty, duration_minutes, is_free, company_id, price_paise")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!test) return null;

  const [stats, links, company] = await Promise.all([
    supabase.from("published_mock_tests").select("question_count, total_marks, attempt_count, has_negative_marking").eq("id", test.id).maybeSingle(),
    supabase.from("mock_test_categories").select("category_id").eq("test_id", test.id),
    test.company_id
      ? supabase.from("companies").select("name, slug").eq("id", test.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const categoryIds = (links.data ?? []).map((l) => l.category_id);
  let topics: string[] = [];
  if (categoryIds.length > 0) {
    const { data: categories } = await supabase.from("categories").select("name").in("id", categoryIds).order("name");
    topics = (categories ?? []).map((c) => c.name);
  }

  return {
    id: test.id,
    slug: test.slug,
    title: test.title,
    description: test.description,
    instructions: test.instructions,
    pricePaise: test.price_paise,
    companyName: company.data?.name ?? null,
    companySlug: company.data?.slug ?? null,
    difficulty: test.difficulty,
    durationMinutes: test.duration_minutes,
    isFree: test.is_free,
    questionCount: stats.data?.question_count ?? 0,
    totalMarks: Number(stats.data?.total_marks ?? 0),
    attemptCount: stats.data?.attempt_count ?? 0,
    hasNegativeMarking: stats.data?.has_negative_marking ?? false,
    topics,
  };
});

/**
 * The signed-in student's running attempt for a test, if any (Row Level
 * Security limits this to their own attempts). Lets the instructions page
 * say "Resume" instead of "Start".
 */
export async function getActiveAttemptId(testId: string, userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("test_attempts")
    .select("id, expires_at")
    .eq("test_id", testId)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.id;
}
