import { describe, expect, it } from "vitest";
import { getSiteUrl, readSupabaseEnv } from "@/lib/env";
import { loginErrorMessage, registerErrorMessage } from "@/lib/auth/error-messages";

describe("readSupabaseEnv", () => {
  it("accepts a valid configuration", () => {
    const r = readSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(40),
    });
    expect(r).toEqual({ ok: true, url: "https://abc.supabase.co", anonKey: "x".repeat(40) });
  });

  it("accepts a local http URL", () => {
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "y".repeat(30) }).ok).toBe(true);
  });

  it("names the missing variables but never echoes values", () => {
    const r = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "secret-ish" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const text = r.problems.join(" ");
      expect(text).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(text).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      expect(text).not.toContain("secret-ish");
      expect(text).not.toContain("not-a-url");
    }
  });

  it("treats missing variables as invalid", () => {
    expect(readSupabaseEnv({}).ok).toBe(false);
  });
});

describe("getSiteUrl", () => {
  it("strips trailing slashes and defaults to localhost", () => {
    expect(getSiteUrl("https://placementways.in///")).toBe("https://placementways.in");
    expect(getSiteUrl("")).toBe("http://localhost:3000");
    expect(getSiteUrl(undefined)).toBe("http://localhost:3000");
  });
});

describe("auth error messages", () => {
  it("uses one message for unknown user and wrong password (no account enumeration)", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(loginErrorMessage({ code: "user_not_found", status: 400 }));
  });
  it("surfaces unconfirmed email and rate limiting", () => {
    expect(loginErrorMessage({ code: "email_not_confirmed" })).toMatch(/confirm your email/i);
    expect(loginErrorMessage({ status: 429 })).toMatch(/too many/i);
    expect(registerErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(/too many/i);
  });
  it("reports outages distinctly from bad credentials", () => {
    expect(loginErrorMessage({ status: 0 })).toMatch(/couldn't reach/i);
  });
});
