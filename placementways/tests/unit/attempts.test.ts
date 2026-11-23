import { describe, expect, it } from "vitest";
import { formatClock, formatDurationWords, formatMarks, accuracyPercent } from "@/lib/format";
import { attemptStateSchema, attemptResultSchema, saveAnswerInputSchema, submitInputSchema } from "@/lib/attempts/schemas";

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(599)).toBe("9:59");
  });

  it("includes hours once the count reaches an hour", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("clamps negative values to zero instead of showing a negative countdown", () => {
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("formatDurationWords", () => {
  it("uses the smallest sensible unit", () => {
    expect(formatDurationWords(45)).toBe("45 s");
    expect(formatDurationWords(90)).toBe("1 min 30 s");
    expect(formatDurationWords(120)).toBe("2 min");
    expect(formatDurationWords(3665)).toBe("1 h 1 min");
    expect(formatDurationWords(3600)).toBe("1 h");
  });
});

describe("formatMarks", () => {
  it("drops trailing zeros but keeps meaningful decimals", () => {
    expect(formatMarks(2)).toBe("2");
    expect(formatMarks(0.5)).toBe("0.5");
    expect(formatMarks(2.5)).toBe("2.5");
    expect(formatMarks(-0.25)).toBe("-0.25");
    expect(formatMarks(0)).toBe("0");
  });
});

describe("accuracyPercent", () => {
  it("is the share of correct answers among attempted questions", () => {
    expect(accuracyPercent(3, 1)).toBe(75);
    expect(accuracyPercent(0, 0)).toBe(0);
    expect(accuracyPercent(4, 0)).toBe(100);
  });
});

describe("attemptStateSchema", () => {
  const base = {
    attempt: { id: "a1", status: "in_progress", started_at: "2026-01-01T00:00:00Z", expires_at: "2026-01-01T00:30:00Z", server_now: "2026-01-01T00:05:00Z" },
    test: { id: "t1", title: "Mock", slug: "mock", instructions: null, duration_minutes: 30 },
  };

  it("accepts a valid in-progress state with questions and answers", () => {
    const r = attemptStateSchema.safeParse({
      ...base,
      questions: [{ id: "q1", order: 1, type: "mcq", text: "2+2?", marks: 1, negative_marks: 0, options: [{ key: "A", text: "3" }] }],
      answers: [{ question_id: "q1", selected_answer: null, marked_for_review: false }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a submitted state without questions/answers", () => {
    expect(attemptStateSchema.safeParse({ ...base, attempt: { ...base.attempt, status: "submitted" } }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(attemptStateSchema.safeParse({ ...base, attempt: { ...base.attempt, status: "cancelled" } }).success).toBe(false);
  });
});

describe("attemptResultSchema", () => {
  it("accepts a well-formed result", () => {
    const r = attemptResultSchema.safeParse({
      attempt: {
        id: "a1", status: "submitted", started_at: "2026-01-01T00:00:00Z", submitted_at: "2026-01-01T00:20:00Z",
        score: 2.5, total_marks: 5, time_used_seconds: 1200,
      },
      test: { id: "t1", title: "Mock", slug: "mock", duration_minutes: 30 },
      summary: { question_count: 3, correct: 2, incorrect: 1, unanswered: 0 },
      questions: [{
        id: "q1", order: 1, type: "mcq", text: "2+2?", difficulty: "easy", category_id: "c1", category_name: "Aptitude",
        explanation: null, correct_answer: "A", selected_answer: "A", is_correct: true, marks_awarded: 2,
        marked_for_review: false, marks: 2, negative_marks: 0.5, options: [{ key: "A", text: "4" }],
      }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an in-progress status (results should never expose an unfinished attempt)", () => {
    const r = attemptResultSchema.safeParse({
      attempt: { id: "a1", status: "in_progress", started_at: "x", submitted_at: "x", score: 0, total_marks: 0, time_used_seconds: 0 },
      test: { id: "t1", title: "Mock", slug: "mock", duration_minutes: 30 },
      summary: { question_count: 0, correct: 0, incorrect: 0, unanswered: 0 },
      questions: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("saveAnswerInputSchema", () => {
  it("accepts a real option letter or null", () => {
    expect(saveAnswerInputSchema.safeParse({ attemptId: crypto.randomUUID(), questionId: crypto.randomUUID(), selected: "A", marked: false }).success).toBe(true);
    expect(saveAnswerInputSchema.safeParse({ attemptId: crypto.randomUUID(), questionId: crypto.randomUUID(), selected: null, marked: true }).success).toBe(true);
  });

  it("rejects a non-letter or multi-character selection (defence in depth before it ever reaches the database)", () => {
    expect(saveAnswerInputSchema.safeParse({ attemptId: crypto.randomUUID(), questionId: crypto.randomUUID(), selected: "1", marked: false }).success).toBe(false);
    expect(saveAnswerInputSchema.safeParse({ attemptId: crypto.randomUUID(), questionId: crypto.randomUUID(), selected: "AB", marked: false }).success).toBe(false);
  });

  it("rejects a non-uuid attempt or question id", () => {
    expect(saveAnswerInputSchema.safeParse({ attemptId: "not-a-uuid", questionId: crypto.randomUUID(), selected: "A", marked: false }).success).toBe(false);
  });
});

describe("submitInputSchema", () => {
  it("accepts an attempt id with an answer list", () => {
    const r = submitInputSchema.safeParse({
      attemptId: crypto.randomUUID(),
      answers: [{ questionId: crypto.randomUUID(), selected: "B", marked: true }],
    });
    expect(r.success).toBe(true);
  });

  it("caps the number of answers (a sanity ceiling, not a real-world limit)", () => {
    const answers = Array.from({ length: 501 }, () => ({ questionId: crypto.randomUUID(), selected: null, marked: false }));
    expect(submitInputSchema.safeParse({ attemptId: crypto.randomUUID(), answers }).success).toBe(false);
  });
});
