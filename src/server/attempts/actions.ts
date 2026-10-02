"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import {
  saveAnswerInputSchema,
  submitInputSchema,
} from "@/lib/attempts/schemas";
import { getSession, requireUser } from "@/server/auth/session";

/**
 * Every action here is a thin wrapper: the rules (who owns the attempt, the
 * deadline, which questions belong to the test, scoring) are enforced by the
 * database functions. Student identity comes from Supabase Auth; guest identity
 * comes from the HttpOnly cookie through the server-only gateway. An attempt ID
 * alone never authorizes access. Wrappers add validation and friendly errors.
 */

import { guestClient, guestHash, networkRateHash, guestOperation } from "@/server/access/guest";
import { guestDecisionSchema } from "@/server/access/decisions";
import { attemptRpc } from "@/server/access/attempt-rpc";

const testIdSchema = z.uuid();

/** Bound as `startAttempt.bind(null, testId)` and used with useActionState. Starting twice resumes the same attempt. */
export async function startAttempt(
  testId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!testIdSchema.safeParse(testId).success) {
    return { status: "error", message: "That test could not be found." };
  }

  const session = await getSession();
  if (session.state === "inactive") return { status: "error", message: "Your account is inactive." };
  if (session.state === "anonymous") {
    let attemptId: string | undefined;
    try {
      await guestHash(true);
      const { data, error } = await guestOperation({ p_operation: "start", p_test_id: testId, p_network_hash: await networkRateHash() });
      const result = guestDecisionSchema.safeParse(data);
      if (error || !result.success) return { status: "error", message: "We couldn't start the test. Please try again." };
      if (result.data.decision !== "allow") return { status: "error", message: result.data.decision === "rate_limited" ? "Free guest attempts are temporarily limited on this network. Please log in or try again tomorrow." : result.data.decision === "premium" ? "This mock requires premium access." : "Create your free account to continue." };
      attemptId = result.data.attempt_id;
    } catch { return { status: "error", message: "Guest mocks are temporarily unavailable. Please try again later." }; }
    if (attemptId) redirect(`/attempts/${attemptId}`);
    return { status: "error", message: "We couldn't start the test. Please try again." };
  }
  const supabase = await createClient();
  const { data: attemptId, error } = await supabase.rpc("start_test_attempt", {
    p_test_id: testId,
  });

  if (error || !attemptId) {
    console.error("[attempts] could not start attempt", { code: error?.code });
    if (error?.code === "23514") {
      // "This test has no questions yet" / "Test is not available" are already plain-language.
      return {
        status: "error",
        message: error.message || "This test isn't available right now.",
      };
    }
    if (error?.code === "42501") {
      return {
        status: "error",
        message: "This test is locked or your account is inactive.",
      };
    }
    return {
      status: "error",
      message: "We couldn't start the test. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  redirect(`/attempts/${attemptId}`);
}

export type SaveAnswerResult = {
  /**
   * saved    - stored.
   * closed   - the attempt is over (submitted elsewhere, or out of time): go to the result.
   * rejected - permanently invalid (e.g. the question was removed from the test): don't retry.
   * error    - temporary problem: the browser should retry.
   */
  status: "saved" | "closed" | "rejected" | "error";
};

/** Called from the browser every time the student changes an answer or its review flag. */
export async function saveAnswer(
  input: z.input<typeof saveAnswerInputSchema>,
): Promise<SaveAnswerResult> {
  const parsed = saveAnswerInputSchema.safeParse(input);
  if (!parsed.success) return { status: "rejected" };

  const { data, error } = await attemptRpc("save_attempt_answer", {
    p_attempt_id: parsed.data.attemptId,
    p_question_id: parsed.data.questionId,
    p_selected: parsed.data.selected,
    p_marked: parsed.data.marked,
  });

  if (error) {
    // Not the caller's attempt / not in this test / not a real option: retrying can't help.
    if (
      error.code === "P0002" ||
      error.code === "23514" ||
      error.code === "23503"
    )
      return { status: "rejected" };
    console.error("[attempts] could not save answer", { code: error.code });
    return { status: "error" };
  }
  if (data !== "closed" && data !== "saved") return { status: "rejected" };
  return { status: data === "closed" ? "closed" : "saved" };
}

export type SubmitResult = { status: "submitted" | "expired" | "error" };

/**
 * Final submission. The browser sends its full answer map as a safety net
 * (a save lost to a network blip can't cost an answer). Submitting twice is
 * harmless: the database reports the existing outcome instead of re-scoring.
 */
export async function submitAttempt(
  input: z.input<typeof submitInputSchema>,
): Promise<SubmitResult> {
  const parsed = submitInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };

  const { data, error } = await attemptRpc("submit_attempt", {
    p_attempt_id: parsed.data.attemptId,
    p_answers: parsed.data.answers.map((a) => ({
      question_id: a.questionId,
      selected_answer: a.selected,
      marked_for_review: a.marked,
    })),
  });

  if (error || (data !== "submitted" && data !== "expired")) {
    console.error("[attempts] could not submit attempt", { code: error?.code });
    return { status: "error" };
  }

  revalidatePath("/dashboard");
  return { status: data };
}

/** Saving a guest result is an explicit, authenticated, ownership-checked action. */
export async function claimGuestResult(attemptId: string, _prev: FormState, _form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!testIdSchema.safeParse(attemptId).success) return { status: "error", message: "Result unavailable." };
  const hash = await guestHash();
  if (!hash) return { status: "error", message: "Open this result in the browser where you took the mock." };
  const { data, error } = await guestClient().rpc("claim_guest_mock", { p_token_hash: hash, p_attempt_id: attemptId, p_user_id: user.id });
  if (error || !data) return { status: "error", message: "This result could not be saved to your account." };
  revalidatePath("/dashboard");
  revalidatePath(`/attempts/${attemptId}/result`);
  return { status: "success", message: "Result saved to your account." };
}
