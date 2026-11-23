import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "@/lib/env";
import { hardenCookieOptions } from "./cookies";

/**
 * Supabase client bound to the current request's cookies. It acts AS THE
 * SIGNED-IN USER, so every query is filtered by Row Level Security.
 * Create one per request; never cache it in a module-level variable.
 */
export async function createClient() {
  // Read cookies FIRST: this marks the calling page as request-time (dynamic),
  // so private pages are never prerendered at build time.
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenCookieOptions(options));
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the proxy refreshes the session on the next request.
        }
      },
    },
  });
}
