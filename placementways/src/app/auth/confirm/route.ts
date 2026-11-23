import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/paths";
import { confirmLinkSchema } from "@/lib/validation/auth";

/**
 * Landing point for the links in Supabase emails (signup confirmation,
 * password reset). The email template points here with a one-time token_hash;
 * we exchange it for a session on the server.
 *
 * Using token_hash (not the PKCE `code` flow) means the link works even when
 * the student opens the email on a different device or in an in-app browser
 * -- common for Gmail on phones.
 *
 * See README "Supabase setup" for the exact email templates.
 */
export async function GET(request: NextRequest) {
  const parsed = confirmLinkSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) redirect("/login?error=invalid_link");

  const { token_hash, type, next } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    redirect(type === "recovery" ? "/forgot-password?error=expired" : "/login?error=invalid_link");
  }

  // After a recovery link the ONLY sensible place is the new-password form.
  redirect(type === "recovery" ? "/reset-password" : safeNextPath(next));
}
