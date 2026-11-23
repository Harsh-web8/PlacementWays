import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

/**
 * DATA ACCESS LAYER for identity. Every protected page, layout and Server
 * Action goes through here, because proxy checks alone can be bypassed
 * (Server Actions are plain POST endpoints; prefetching skips layouts).
 *
 * Trust rules:
 *   - identity comes from supabase.auth.getUser(), which asks the Auth server
 *     to validate the token (not just decode it);
 *   - the ROLE comes from the profiles table, never from the JWT, user
 *     metadata or anything else the client can influence.
 */

export type UserRole = Enums<"user_role">;

/** What the UI is allowed to know about the current user (a DTO, not a DB row). */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  college: string | null;
  degree: string | null;
  graduationYear: number | null;
};

export type SessionState =
  | { state: "anonymous" }
  | { state: "inactive" }
  | { state: "active"; user: SessionUser };

/** Memoised per request, so calling it in a layout AND a page costs one lookup. */
export const getSession = cache(async (): Promise<SessionState> => {
  const supabase = await createClient();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { state: "anonymous" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, role, is_active, college, degree, graduation_year")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] could not load profile", { code: profileError.code });
    return { state: "anonymous" };
  }
  if (!profile) {
    // Signed in at Auth but no profile row: the signup trigger did not run.
    console.error("[auth] authenticated user has no profile row", { userId: auth.user.id });
    return { state: "anonymous" };
  }
  if (!profile.is_active) return { state: "inactive" };

  return {
    state: "active",
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      college: profile.college,
      degree: profile.degree,
      graduationYear: profile.graduation_year,
    },
  };
});

/** The signed-in, active user or null. For pages that adapt but don't require login. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.state === "active" ? session.user : null;
}

/** Require a signed-in, active user; otherwise redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (session.state === "active") return session.user;
  if (session.state === "inactive") redirect("/login?error=inactive");
  redirect("/login");
}

/**
 * Require an active admin. Everyone else -- anonymous OR a normal student --
 * gets a 404, so the existence of the admin area is not confirmed to them.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (session.state !== "active") notFound();
  if (session.user.role !== "admin") notFound();
  return session.user;
}
