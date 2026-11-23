import { describe, expect, it } from "vitest";
import { z } from "zod";
import { questionSchema, optionsPayload } from "@/lib/validation/question";
import { categorySchema } from "@/lib/validation/category";
import { mockTestSchema } from "@/lib/validation/mock-test";
import { csvRowSchema, mapCsvHeaders, toCanonicalRow, resolveCategoryId } from "@/lib/validation/csv-import";

const errorsOf = (r: { success: boolean; error?: z.ZodError }): Record<string, string[] | undefined> =>
  r.error ? (z.flattenError(r.error).fieldErrors as Record<string, string[] | undefined>) : {};

describe("questionSchema", () => {
  const validMcq = {
    categoryId: "11111111-1111-1111-1111-111111111111",
    questionType: "mcq",
    questionText: "What is 2 + 2?",
    difficulty: "easy",
    explanation: "",
    marks: "1",
    negativeMarks: "0.25",
    status: "draft",
    correctAnswer: "B",
    tags: "arithmetic, basics",
    optionA: "3",
    optionB: "4",
    optionC: "5",
    optionD: "",
    optionE: "",
    optionF: "",
  };

  it("accepts a valid MCQ and coerces numbers / tags", () => {
    const r = questionSchema.safeParse(validMcq);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.marks).toBe(1);
      expect(r.data.negativeMarks).toBe(0.25);
      expect(r.data.tags).toEqual(["arithmetic", "basics"]);
      expect(optionsPayload(r.data)).toEqual([
        { option_key: "A", option_text: "3" },
        { option_key: "B", option_text: "4" },
        { option_key: "C", option_text: "5" },
      ]);
    }
  });

  it("requires at least two options for an MCQ", () => {
    const r = questionSchema.safeParse({ ...validMcq, optionB: "", optionC: "", correctAnswer: "A" });
    expect(errorsOf(r).optionA).toBeDefined();
  });

  it("requires a correct answer for an MCQ", () => {
    expect(errorsOf(questionSchema.safeParse({ ...validMcq, correctAnswer: "" })).correctAnswer).toBeDefined();
  });

  it("rejects a correct answer that isn't one of the filled-in options", () => {
    expect(errorsOf(questionSchema.safeParse({ ...validMcq, correctAnswer: "D" })).correctAnswer).toBeDefined();
  });

  it("does not require options for a coding question", () => {
    const r = questionSchema.safeParse({
      ...validMcq,
      questionType: "coding",
      correctAnswer: "",
      optionA: "",
      optionB: "",
      optionC: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(optionsPayload(r.data)).toEqual([]);
  });

  it("rejects a non-numeric or zero marks value", () => {
    expect(errorsOf(questionSchema.safeParse({ ...validMcq, marks: "abc" })).marks).toBeDefined();
    expect(errorsOf(questionSchema.safeParse({ ...validMcq, marks: "0" })).marks).toBeDefined();
  });

  it("rejects a negative value for negative marks but allows zero", () => {
    expect(errorsOf(questionSchema.safeParse({ ...validMcq, negativeMarks: "-1" })).negativeMarks).toBeDefined();
    expect(questionSchema.safeParse({ ...validMcq, negativeMarks: "0" }).success).toBe(true);
  });
});

describe("categorySchema", () => {
  it("accepts a valid top-level category", () => {
    const r = categorySchema.safeParse({ name: "Aptitude", slug: "aptitude", description: "", parentId: "", sortOrder: "10" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sortOrder).toBe(10);
  });

  it("rejects an invalid slug", () => {
    expect(errorsOf(categorySchema.safeParse({ name: "Aptitude", slug: "Aptitude!", description: "", parentId: "", sortOrder: "0" })).slug).toBeDefined();
  });
});

describe("mockTestSchema", () => {
  const valid = {
    title: "TCS NQT Full Mock 1",
    slug: "tcs-nqt-full-mock-1",
    description: "",
    instructions: "",
    durationMinutes: "60",
    difficulty: "medium",
    isFree: "true",
    companyId: "",
  };

  it("accepts valid input and coerces duration / isFree", () => {
    const r = mockTestSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.durationMinutes).toBe(60);
      expect(r.data.isFree).toBe(true);
    }
  });

  it("rejects a duration outside 1-600 minutes", () => {
    expect(errorsOf(mockTestSchema.safeParse({ ...valid, durationMinutes: "0" })).durationMinutes).toBeDefined();
    expect(errorsOf(mockTestSchema.safeParse({ ...valid, durationMinutes: "601" })).durationMinutes).toBeDefined();
  });
});

describe("CSV import: header mapping", () => {
  it("maps recognised headers case- and punctuation-insensitively", () => {
    const { canonical, missingRequired } = mapCsvHeaders(["Question", "Question Type", "Category", "Option A", "Correct Answer", "Negative Marks"]);
    expect(canonical).toEqual(["questionText", "questionType", "category", "optionA", "correctAnswer", "negativeMarks"]);
    expect(missingRequired).toEqual([]);
  });

  it("reports missing required columns", () => {
    const { missingRequired } = mapCsvHeaders(["Difficulty", "Marks"]);
    expect(missingRequired).toEqual(["questionText", "category"]);
  });

  it("builds a canonical row object from raw values, ignoring unmapped columns", () => {
    const { canonical } = mapCsvHeaders(["Question", "Some Unknown Column", "Category"]);
    expect(toCanonicalRow(canonical, ["2+2?", "ignored", "aptitude"])).toEqual({ questionText: "2+2?", category: "aptitude" });
  });
});

describe("resolveCategoryId", () => {
  const categories = [
    { id: "1", slug: "aptitude", name: "Aptitude" },
    { id: "2", slug: "percentages", name: "Percentages" },
  ];

  it("matches by slug (case/spacing-insensitive via slugify)", () => {
    expect(resolveCategoryId(categories, "percentages")).toBe("2");
    expect(resolveCategoryId(categories, "Percentages")).toBe("2");
  });

  it("falls back to an exact case-insensitive name match", () => {
    expect(resolveCategoryId(categories, "aptitude")).toBe("1");
  });

  it("returns null for an unknown category", () => {
    expect(resolveCategoryId(categories, "Quantum Mechanics")).toBeNull();
  });
});

describe("csvRowSchema", () => {
  const validRow = {
    questionText: "What is 2 + 2?",
    category: "aptitude",
    questionType: "",
    difficulty: "",
    optionA: "3",
    optionB: "4",
    optionC: "",
    optionD: "",
    correctAnswer: "b",
    explanation: "",
    marks: "",
    negativeMarks: "",
    tags: "arithmetic;basics",
  };

  it("accepts a minimal valid row and fills in defaults", () => {
    const r = csvRowSchema.safeParse(validRow);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.questionType).toBe("mcq");
      expect(r.data.difficulty).toBe("medium");
      expect(r.data.marks).toBe(1);
      expect(r.data.negativeMarks).toBe(0);
      expect(r.data.correctAnswer).toBe("B"); // upper-cased
      expect(r.data.tags).toEqual(["arithmetic", "basics"]);
    }
  });

  it("requires question text and category", () => {
    expect(errorsOf(csvRowSchema.safeParse({ ...validRow, questionText: "" })).questionText).toBeDefined();
    expect(errorsOf(csvRowSchema.safeParse({ ...validRow, category: "" })).category).toBeDefined();
  });

  it("rejects an unrecognised question type or difficulty", () => {
    expect(errorsOf(csvRowSchema.safeParse({ ...validRow, questionType: "essay" })).questionType).toBeDefined();
    expect(errorsOf(csvRowSchema.safeParse({ ...validRow, difficulty: "extreme" })).difficulty).toBeDefined();
  });

  it("requires two options and a matching correct answer for MCQ rows", () => {
    expect(errorsOf(csvRowSchema.safeParse({ ...validRow, optionB: "" })).optionA).toBeDefined();
    expect(errorsOf(csvRowSchema.safeParse({ ...validRow, correctAnswer: "" })).correctAnswer).toBeDefined();
    expect(errorsOf(csvRowSchema.safeParse({ ...validRow, correctAnswer: "z" })).correctAnswer).toBeDefined();
  });

  it("does not require options for a coding row", () => {
    const r = csvRowSchema.safeParse({ ...validRow, questionType: "coding", optionA: "", optionB: "", correctAnswer: "" });
    expect(r.success).toBe(true);
  });
});
