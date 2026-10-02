/**
 * Route-protection rules and redirect safety. Pure functions (no Next imports)
 * so they can be unit-tested exhaustively.
 *
 * IMPORTANT: this is the *optimistic* layer used by the proxy to bounce
 * anonymous visitors early. The authoritative checks are in
 * src/server/auth/session.ts, which every protected page and Server Action
 * calls. Never rely on this file alone.
 */

/** Anything under these prefixes requires a signed-in user. */
export const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/admin", "/progress", "/practice/results", "/orders", "/coding/history", "/coding/submissions"] as const;

/** Pages only meaningful to signed-out visitors. */
export const AUTH_PAGES = ["/login", "/register", "/forgot-password"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function isAuthPage(pathname: string): boolean {
  return [...AUTH_PAGES, "/reset-password"].some((p) => matchesPrefix(pathname, p));
}

/**
 * Returns a same-site path that is safe to redirect to, or `fallback`.
 *
 * Blocks open-redirect tricks such as `//evil.com`, `/\evil.com`,
 * `https://evil.com`, `javascript:` and tab/newline smuggling (browsers strip
 * tabs and newlines, turning `/\t/evil.com` into `//evil.com`).
 */
export function safeNextPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Backslashes and control characters (incl. tab, CR, LF, NUL, DEL).
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, "http://placementways.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://placementways.invalid") return fallback;

  // Don't bounce people between auth pages.
  if (isAuthPage(url.pathname)) return fallback;

  return url.pathname + url.search;
}

export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

/** Optimistic, cookie-level access decision used by the proxy. */
export function decideAccess(
  pathname: string,
  search: string,
  isAuthenticated: boolean,
): AccessDecision {
  if (isProtectedPath(pathname) && !isAuthenticated) {
    const next = encodeURIComponent(pathname + search);
    return { type: "redirect", to: `/login?next=${next}` };
  }
  return { type: "allow" };
}
