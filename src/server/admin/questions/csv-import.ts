"use server";

import Papa from "papaparse";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth/session";
import { logAdminAction } from "@/server/admin/audit";
import { resolveTagIdMap } from "@/server/admin/tags";
import { slugify } from "@/lib/utils";
import { field } from "@/lib/form-state";
import { mapCsvHeaders, toCanonicalRow, csvRowSchema, resolveCategoryId, type CsvRowValues, type CategoryRef } from "@/lib/validation/csv-import";
import { MAX_CSV_FILE_BYTES, CSV_FILE_LIMIT_LABEL, type CsvImportState } from "@/lib/csv-import-state";
import type { Database } from "@/types/database";

const MAX_FILE_BYTES = MAX_CSV_FILE_BYTES;

type ValidatedRow = { rowNumber: number; questionText: string; category: string; data: CsvRowValues; categoryId: string };
type InvalidRow = { rowNumber: number; questionText: string; category: string; errors: string[] };
type ParsedRow = (ValidatedRow & { valid: true }) | (InvalidRow & { valid: false });

/** Shared by preview and confirm, so both see exactly the same validation and the same category resolution. */
function parseAndValidate(csvText: string, categories: CategoryRef[]): { headerError?: string; rows: ParsedRow[] } {
  const result = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true });
  if (result.data.length === 0) return { headerError: "The file is empty.", rows: [] };

  const [headerRow, ...dataRows] = result.data;
  const { canonical, missingRequired } = mapCsvHeaders(headerRow);
  if (missingRequired.length > 0) {
    return { headerError: `The file is missing required column(s): ${missingRequired.join(", ")}.`, rows: [] };
  }
  if (dataRows.length === 0) return { headerError: "No data rows found below the header.", rows: [] };

  const CANONICAL_FIELDS = [
    "questionText",
    "questionType",
    "category",
    "difficulty",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctAnswer",
    "explanation",
    "marks",
    "negativeMarks",
    "tags",
  ] as const;

  const rows: ParsedRow[] = dataRows.map((rawValues, i) => {
    const rowNumber = i + 2; // header is row 1
    const canonicalRow = toCanonicalRow(canonical, rawValues);
    const fullRow = Object.fromEntries(CANONICAL_FIELDS.map((f) => [f, canonicalRow[f] ?? ""]));

    const parsed = csvRowSchema.safeParse(fullRow);
    if (!parsed.success) {
      const errors = Object.values(z.flattenError(parsed.error).fieldErrors).flat().filter((e): e is string => !!e);
      return { valid: false, rowNumber, questionText: fullRow.questionText.slice(0, 80), category: fullRow.category, errors };
    }

    const categoryId = resolveCategoryId(categories, parsed.data.category);
    if (!categoryId) {
      return {
        valid: false,
        rowNumber,
        questionText: parsed.data.questionText.slice(0, 80),
        category: parsed.data.category,
        errors: [`Unknown category "${parsed.data.category}". Use an existing category name or slug.`],
      };
    }

    return {
      valid: true,
      rowNumber,
      questionText: parsed.data.questionText.slice(0, 80),
      category: parsed.data.category,
      data: parsed.data,
      categoryId,
    };
  });

  return { rows };
}

function csvOptionsPayload(row: CsvRowValues): { option_key: string; option_text: string }[] {
  if (row.questionType !== "mcq") return [];
  return (["A", "B", "C", "D"] as const).map((k) => ({ option_key: k, option_text: row[`option${k}`] })).filter((o) => o.option_text !== "");
}

async function loadCategories(supabase: SupabaseClient<Database>): Promise<CategoryRef[]> {
  const { data, error } = await supabase.from("categories").select("id, slug, name");
  if (error) throw new Error("Category lookup failed");
  return data ?? [];
}

/** Step 1: parse and validate only. No database writes -- safe to run, and safe to walk away from. */
export async function previewImport(_prev: CsvImportState, formData: FormData): Promise<CsvImportState> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to upload." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { status: "error", message: "Please upload a file with a .csv extension." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { status: "error", message: `That file is too large (${CSV_FILE_LIMIT_LABEL} max).` };
  }

  const csvText = await file.text();
  if (Buffer.byteLength(csvText, "utf8") > MAX_FILE_BYTES) {
    return { status: "error", message: `That file is too large (${CSV_FILE_LIMIT_LABEL} max).` };
  }
  const supabase = await createClient();
  let categories: CategoryRef[];
  try {
    categories = await loadCategories(supabase);
  } catch {
    return { status: "error", message: "We couldn't load categories. Please try again. Nothing was imported." };
  }

  const { headerError, rows } = parseAndValidate(csvText, categories);
  if (headerError) return { status: "error", message: headerError };

  const validCount = rows.filter((r) => r.valid).length;
  return {
    status: "previewed",
    csvText,
    validCount,
    invalidCount: rows.length - validCount,
    rows: rows.map(({ rowNumber, valid, questionText, category, ...rest }) => ({
      rowNumber,
      valid,
      questionText,
      category,
      errors: "errors" in rest ? rest.errors : [],
    })),
  };
}

/** Step 2: re-parse and re-validate the SAME text server-side (never trust client-echoed structured data), then import atomically. */
export async function confirmImport(_prev: CsvImportState, formData: FormData): Promise<CsvImportState> {
  const admin = await requireAdmin();
  const csvText = field(formData, "csvText");
  if (Buffer.byteLength(csvText, "utf8") > MAX_FILE_BYTES) {
    return { status: "error", message: `That file is too large (${CSV_FILE_LIMIT_LABEL} max).` };
  }
  if (!csvText) {
    return { status: "error", message: "Nothing to import -- please upload the file again." };
  }

  const supabase = await createClient();
  let categories: CategoryRef[];
  try {
    categories = await loadCategories(supabase);
  } catch {
    return { status: "error", message: "We couldn't load categories. Please try again. Nothing was imported." };
  }
  const { headerError, rows } = parseAndValidate(csvText, categories);
  if (headerError) return { status: "error", message: headerError };

  const validRows = rows.filter((r): r is ValidatedRow & { valid: true } => r.valid);
  if (validRows.length === 0) {
    return { status: "error", message: "No valid rows to import. Go back and fix the errors first." };
  }

  let tagIdBySlug: Map<string, string>;
  try {
    tagIdBySlug = await resolveTagIdMap(supabase, validRows.flatMap((r) => r.data.tags));
  } catch {
    return { status: "error", message: "We couldn't resolve the tags for these rows. Please try again." };
  }

  const payload = validRows.map((r) => ({
    category_id: r.categoryId,
    question_type: r.data.questionType,
    question_text: r.data.questionText,
    difficulty: r.data.difficulty,
    explanation: r.data.explanation,
    correct_answer: r.data.questionType === "mcq" ? r.data.correctAnswer : null,
    marks: r.data.marks,
    negative_marks: r.data.negativeMarks,
    status: "draft",
    options: csvOptionsPayload(r.data),
    tag_ids: r.data.tags.map((t) => tagIdBySlug.get(slugify(t))).filter((id): id is string => !!id),
  }));

  const { data: importedIds, error } = await supabase.rpc("admin_import_questions", { p_questions: payload });
  if (error || !importedIds) {
    console.error("[admin] CSV import failed", { code: error?.code });
    return {
      status: "error",
      message:
        error?.code === "23514" || error?.code === "23503"
          ? `Import failed: ${error.message}. Nothing was imported -- fix the file and try again.`
          : "We couldn't import these questions. Nothing was imported. Please try again.",
    };
  }

  await logAdminAction(supabase, admin.id, "question.import", "question", null, { count: importedIds.length });
  revalidatePath("/admin/questions");
  return { status: "imported", importedCount: importedIds.length };
}
