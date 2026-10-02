import { z } from "zod";
import { DIFFICULTIES } from "../validation/question";

/**
 * The attempt functions return `jsonb`, which the generated types can only
 * call `Json`. Parsing it here gives the rest of the app real types AND a
 * safety net: if the database shape and the UI ever drift apart, we fail
 * loudly in one place instead of rendering `undefined` to a student.
 */

const optionSchema = z.object({ key: z.string(), text: z.string() });

const questionTypeSchema = z.enum(["mcq", "coding", "debugging"]);
const difficultySchema = z.enum(DIFFICULTIES);

export const attemptStateSchema = z.object({
  attempt: z.object({
    id: z.string(),
    status: z.enum(["in_progress", "submitted", "expired"]),
    started_at: z.string(),
    expires_at: z.string(),
    server_now: z.string(),
  }),
  test: z.object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    instructions: z.string().nullable(),
    duration_minutes: z.number(),
  }),
  // Present only while the attempt is in progress. Never contains correct answers.
  questions: z
    .array(
      z.object({
        id: z.string(),
        order: z.number(),
        type: questionTypeSchema,
        text: z.string(),
        marks: z.number(),
        negative_marks: z.number(),
        options: z.array(optionSchema),
      }),
    )
    .optional(),
  answers: z
    .array(
      z.object({
        question_id: z.string(),
        selected_answer: z.string().nullable(),
        marked_for_review: z.boolean(),
      }),
    )
    .optional(),
});

export type AttemptState = z.infer<typeof attemptStateSchema>;
export type AttemptQuestion = NonNullable<AttemptState["questions"]>[number];

export const attemptResultSchema = z.object({
  attempt: z.object({
    id: z.string(),
    status: z.enum(["submitted", "expired"]),
    started_at: z.string(),
    submitted_at: z.string(),
    score: z.number(),
    total_marks: z.number(),
    time_used_seconds: z.number(),
  }),
  test: z.object({ id: z.string(), title: z.string(), slug: z.string(), duration_minutes: z.number() }),
  summary: z.object({
    question_count: z.number(),
    correct: z.number(),
    incorrect: z.number(),
    unanswered: z.number(),
  }),
  questions: z.array(
    z.object({
      id: z.string(),
      order: z.number().nullable(),
      type: questionTypeSchema,
      text: z.string(),
      difficulty: difficultySchema,
      category_id: z.string(),
      category_name: z.string(),
      explanation: z.string().nullable(),
      correct_answer: z.string().nullable(),
      selected_answer: z.string().nullable(),
      is_correct: z.boolean().nullable(),
      marks_awarded: z.number().nullable(),
      marked_for_review: z.boolean(),
      marks: z.number().nullable(),
      negative_marks: z.number().nullable(),
      options: z.array(optionSchema),
    }),
  ),
});

export type AttemptResult = z.infer<typeof attemptResultSchema>;

/** What the browser sends to save one answer. */
export const saveAnswerInputSchema = z.object({
  attemptId: z.uuid(),
  questionId: z.uuid(),
  // A single option letter, or null to clear the answer.
  selected: z
    .string()
    .regex(/^[A-Z]$/)
    .nullable(),
  marked: z.boolean(),
});

/** What the browser sends at the end: its full answer map, as a safety net for saves lost to a network blip. */
export const submitInputSchema = z.object({
  attemptId: z.uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        selected: z
          .string()
          .regex(/^[A-Z]$/)
          .nullable(),
        marked: z.boolean(),
      }),
    )
    .max(500),
});
