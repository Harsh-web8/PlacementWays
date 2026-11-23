"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/env";
import { field, type FormState } from "@/lib/form-state";
import { safeNextPath } from "@/lib/auth/paths";
import {
  loginErrorMessage,
  passwordUpdateErrorMessage,
  registerErrorMessage,
} from "@/lib/auth/error-messages";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

/*
 * Every export here is a public HTTP endpoint (a Server Action is a POST
 * route). So each one: validates input with Zod, never trusts client-supplied
 * roles or ids, and returns safe messages.
 *
 * Next.js checks the Origin header on Server Actions, which is the CSRF
 * protection for these forms.
 *
 * NOTE: redirect() works by throwing, so it must never be inside try/catch.
 */

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors;

/* ------------------------------------------------------------------ */
export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  };
  const next = safeNextPath(field(formData, "next"));
  const echo = { name: raw.name, email: raw.email }; // never echo passwords

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: echo };
  }
  const { name, email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stored as user metadata and copied to profiles.name by a DB trigger.
      // A role is deliberately NOT sent: the trigger ignores it anyway.
      data: { name },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  // An existing account is reported exactly like a new one (no enumeration).
  if (error && error.code !== "user_already_exists") {
    return { status: "error", message: registerErrorMessage(error), values: echo };
  }

  // Email confirmation disabled in Supabase: a session already exists.
  if (data?.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  return {
    status: "success",
    message: `We've sent a confirmation link to ${email}. Open it to activate your account. If you already have an account, log in or reset your password instead.`,
  };
}

/* ------------------------------------------------------------------ */
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    email: field(formData, "email"),
    password: field(formData, "password"),
    next: field(formData, "next") || undefined,
  };
  const echo = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: echo };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return { status: "error", message: loginErrorMessage(error ?? {}), values: echo };
  }

  // Deactivated accounts must not get in even with a valid password.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "This account is not active. Please contact support if you think this is a mistake.",
      values: echo,
    };
  }

  const fallback = profile.role === "admin" ? "/admin" : "/dashboard";
  revalidatePath("/", "layout");
  redirect(safeNextPath(parsed.data.next, fallback));
}

/* ------------------------------------------------------------------ */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/* ------------------------------------------------------------------ */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: field(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);

  // Rate limiting is the only failure worth telling the user about; anything
  // else gets the same success message so accounts cannot be enumerated.
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    return {
      status: "error",
      message: "Too many reset requests. Please wait a few minutes and try again.",
      values: raw,
    };
  }
  if (error) console.error("[auth] password reset request failed", { code: error.code, status: error.status });

  return {
    status: "success",
    message: "If an account exists for that email, a reset link is on its way. It may take a minute to arrive.",
  };
}

/* ------------------------------------------------------------------ */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  // The recovery link (/auth/confirm) created a session. No session = expired link.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      status: "error",
      message: "Your reset link has expired. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: passwordUpdateErrorMessage(error) };
  }

  // Changing a password should sign out every OTHER device.
  await supabase.auth.signOut({ scope: "others" });

  revalidatePath("/", "layout");
  redirect("/dashboard?notice=password-updated");
}
