import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function guestClient() {
  const { url } = requireSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Guest mocks need server Supabase configuration.");
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function guestHash(create = false): Promise<string | null> {
  const cookieName = process.env.NODE_ENV === "production" ? "__Host-pw-guest" : "pw-guest";
  const jar = await cookies();
  let token = jar.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) return null;
    token = randomBytes(32).toString("hex");
    jar.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  }
  return createHash("sha256").update(token).digest("hex");
}
/** Configure ONLY a header overwritten by the trusted ingress; never trust arbitrary forwarded headers. */
export async function networkRateHash() {
  const secret = process.env.GUEST_RATE_LIMIT_SECRET;
  const header = process.env.GUEST_TRUSTED_IP_HEADER;
  if (!secret || secret.length < 32 || !header) throw new Error("Guest rate limiting is not configured.");
  const value = (await headers()).get(header)?.trim();
  if (!value || !isIP(value)) throw new Error("Trusted visitor address unavailable.");
  // Daily HMAC makes stored rate keys unlinkable across days. Raw addresses are never stored.
  return createHmac("sha256", secret).update(`${new Date().toISOString().slice(0, 10)}:${value}`).digest("hex");
}
export async function guestOperation(args: Omit<Database["public"]["Functions"]["guest_mock_gateway"]["Args"], "p_token_hash">) {
  const hash = await guestHash();
  if (!hash) return { data: null, error: null };
  return guestClient().rpc("guest_mock_gateway", { ...args, p_token_hash: hash });
}
