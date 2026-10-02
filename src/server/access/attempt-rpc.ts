import "server-only";
import { getSession } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { guestOperation } from "./guest";
import type { Json } from "@/types/database";

type Operation = "get_attempt_state" | "get_attempt_result" | "save_attempt_answer" | "submit_attempt";
type Args = { p_attempt_id: string; p_question_id?: string; p_selected?: string | null; p_marked?: boolean; p_answers?: Json };
const operations = { get_attempt_state: "state", get_attempt_result: "result", save_attempt_answer: "save", submit_attempt: "submit" };
export async function attemptRpc(name: Operation, args: Args) {
  const session = await getSession();
  if (session.state === "inactive") return { data: null, error: { code: "42501" } };
  if (session.state === "active") {
    const db = await createClient();
    const { data: own, error } = await db.from("test_attempts").select("id").eq("id", args.p_attempt_id).eq("user_id", session.user.id).maybeSingle();
    if (error) return { data: null, error };
    if (own) {
      if (name === "save_attempt_answer") return db.rpc(name, { p_attempt_id: args.p_attempt_id, p_question_id: args.p_question_id!, p_selected: args.p_selected ?? null, p_marked: args.p_marked ?? false });
      return db.rpc(name, args);
    }
  }
  try { return await guestOperation({ ...args, p_operation: operations[name] }); }
  catch { return { data: null, error: { code: "guest_unavailable" } }; }
}
