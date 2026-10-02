import { afterEach, describe, expect, it, vi } from "vitest";

async function headersFor(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const config = (await import("../../next.config")).default;
  const rules = await config.headers!();
  return Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
}

afterEach(() => vi.unstubAllEnvs());

describe("security headers", () => {
  it("always sends the baseline hardening headers", async () => {
    const h = await headersFor({ NODE_ENV: "development" });
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Content-Security-Policy"]).toBeUndefined();
  });

  it("sends a restrictive CSP in production builds", async () => {
    const h = await headersFor({ NODE_ENV: "production", DEPLOYMENT_ENV: "staging" });
    const csp = h["Content-Security-Policy"];
    for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "connect-src 'self'"]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });

  it("adds HSTS and upgrade-insecure-requests only for the real production deployment", async () => {
    const h = await headersFor({ NODE_ENV: "production", DEPLOYMENT_ENV: "production" });
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(h["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
  });
});
