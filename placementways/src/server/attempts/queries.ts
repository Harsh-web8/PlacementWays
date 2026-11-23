import "server-only";
import { z } from "zod";
import { attemptRpc } from "@/server/access/attempt-rpc";
import {
  attemptStateSchema,
  attemptResultSchema,
  type AttemptState,
  type AttemptResult,
} from "@/lib/attempts/schemas";

const uuidSchema = z.uuid();

/**
 * What the test-taking screen needs. Runs the database function as the
 * verified student or guest owner; it returns null for anything not theirs, and it
 * never includes correct answers. Also expires an over-time attempt.
 */
export async function getAttemptState(attemptId: string): Promise<AttemptState | null> {
  if (!uuidSchema.safeParse(attemptId).success) return null;

  const { data, error } = await attemptRpc("get_attempt_state", { p_attempt_id: attemptId });
  if (error) {
    console.error("[attempts] could not load attempt state", { code: error.code });
    return null;
  }
  if (!data) return null;

  const parsed = attemptStateSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[attempts] attempt state had an unexpected shape");
    return null;
  }
  return parsed.data;
}

/** The result, or null if the attempt isn't theirs OR is still running (so answers can't be read early). */
export async function getAttemptResult(attemptId: string): Promise<AttemptResult | null> {
  if (!uuidSchema.safeParse(attemptId).success) return null;

  const { data, error } = await attemptRpc("get_attempt_result", { p_attempt_id: attemptId });
  if (error) {
    console.error("[attempts] could not load attempt result", { code: error.code });
    return null;
  }
  if (!data) return null;

  const parsed = attemptResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[attempts] attempt result had an unexpected shape");
    return null;
  }
  return parsed.data;
}
