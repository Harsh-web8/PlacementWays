import "server-only";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { guestClient, guestHash } from "./guest";
export const decisionSchema = z.enum(["allow", "login", "premium", "limit", "unavailable", "rate_limited"]);
export const guestDecisionSchema = z.object({ decision: decisionSchema, attempt_id: z.uuid().optional() });
export async function mockAccess(testId: string) {
  const session = await getSession();
  if (session.state === "inactive") return "login";
  if (session.state === "active") {
    const { data, error } = await (await createClient()).rpc("mock_access_decision", { p_test_id: testId });
    return error ? "unavailable" : decisionSchema.parse(data);
  }
  try {
    // Read-only eligibility check does not create a guest cookie or reserve quota.
    const hash = await guestHash() ?? "0".repeat(64);
    const { data, error } = await guestClient().rpc("guest_mock_gateway", { p_operation: "access", p_token_hash: hash, p_test_id: testId });
    return error ? "unavailable" : guestDecisionSchema.parse(data).decision;
  } catch {
    return "unavailable";
  }
}
