import type { CookieOptions } from "@supabase/ssr";

/**
 * Session cookies are set ONLY by our server code (proxy, Server Actions,
 * route handlers) and read only by our server code -- the browser never talks
 * to Supabase Auth directly. So we can mark them HttpOnly: even if an XSS bug
 * appeared later, injected script could not read the session tokens.
 *
 * If a future feature needs the Supabase *browser* client (e.g. realtime),
 * revisit this deliberately rather than by accident.
 */
export function hardenCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
