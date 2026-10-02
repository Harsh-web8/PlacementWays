import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { readSupabaseEnv } from "@/lib/env";
import { decideAccess, isProtectedPath } from "@/lib/auth/paths";
import { hardenCookieOptions } from "./cookies";

/** Does the request carry a Supabase session cookie at all? (cheap pre-check) */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

/**
 * Runs on (almost) every request:
 *   1. refreshes an expiring session and re-issues the cookies, and
 *   2. bounces anonymous visitors away from protected pages (optimistic check).
 *
 * This is NOT the security boundary. Pages and Server Actions re-verify the
 * user and role through src/server/auth/session.ts.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const protectedPath = isProtectedPath(pathname);

  const env = readSupabaseEnv();
  if (!env.ok) {
    // Fail CLOSED for protected pages; keep public pages working so a fresh
    // clone still renders the homepage before Supabase is configured.
    if (protectedPath) {
      return new NextResponse(
        "Authentication is not configured. Copy .env.example to .env.local and set the Supabase variables.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  let isAuthenticated = false;

  if (hasSessionCookie(request)) {
    const supabase = createServerClient<Database>(env.url, env.anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, hardenCookieOptions(options));
          }
        },
      },
    });

    try {
      // Verifies the JWT (locally for asymmetric keys) and refreshes if expired.
      const { data, error } = await supabase.auth.getClaims();
      isAuthenticated = !error && !!data?.claims;
    } catch {
      isAuthenticated = false; // treat any failure as signed-out
    }
  }

  const decision = decideAccess(pathname, search, isAuthenticated);
  if (decision.type === "redirect") {
    const redirect = NextResponse.redirect(new URL(decision.to, request.url));
    // Carry over any cookies (e.g. a cleared/refreshed session).
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set("cache-control", "private, no-store");
    return redirect;
  }

  if (protectedPath || pathname === "/attempts" || pathname.startsWith("/attempts/")) {
    // Private account and guest attempt pages must never be stored by shared caches.
    response.headers.set("cache-control", "private, no-store");
  }
  return response;
}
