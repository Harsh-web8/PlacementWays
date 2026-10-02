import { describe, expect, it } from "vitest";
import { decideAccess, isProtectedPath, safeNextPath } from "@/lib/auth/paths";

describe("safeNextPath (open-redirect protection)", () => {
  it("accepts ordinary same-site paths, keeping the query string", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/profile?tab=college")).toBe("/profile?tab=college");
    expect(safeNextPath("/admin/companies/new")).toBe("/admin/companies/new");
  });

  it.each([
    ["https://evil.com"],
    ["http://evil.com/x"],
    ["//evil.com"],
    ["//evil.com/path"],
    ["/\\evil.com"],
    ["\\\\evil.com"],
    ["/\t/evil.com"],
    ["/\n/evil.com"],
    ["/\r/evil.com"],
    ["javascript:alert(1)"],
    ["data:text/html,<script>"],
    ["evil.com"],
    ["dashboard"],
    [""],
  ])("rejects %j and falls back", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });

  it("allows percent-encoded characters (they stay on this site)", () => {
    expect(safeNextPath("/%2F/evil.com")).toBe("/%2F/evil.com");
  });

  it("rejects non-strings and absurd lengths", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(42)).toBe("/dashboard");
    expect(safeNextPath({})).toBe("/dashboard");
    expect(safeNextPath("/" + "a".repeat(3000))).toBe("/dashboard");
  });

  it("never sends users back to an auth page (avoids redirect loops)", () => {
    expect(safeNextPath("/login")).toBe("/dashboard");
    expect(safeNextPath("/register?x=1")).toBe("/dashboard");
    expect(safeNextPath("/forgot-password")).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeNextPath("https://evil.com", "/admin")).toBe("/admin");
  });
});

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/dashboard/results", "/profile", "/admin", "/admin/companies/123"])(
    "protects %s",
    (p) => expect(isProtectedPath(p)).toBe(true),
  );

  it.each(["/attempts", "/attempts/abc-123/result", "/courses", "/coding", "/questions/sample", "/", "/login", "/companies/tcs-nqt", "/tests", "/tests/tcs-nqt-mock-1", "/administrator", "/dashboards", "/profiles", "/attempt", "/attemptsomething"])(
    "does not protect %s (prefix must match a whole segment)",
    (p) => expect(isProtectedPath(p)).toBe(false),
  );
});

describe("decideAccess", () => {
  it("redirects anonymous visitors from protected pages, preserving the destination", () => {
    expect(decideAccess("/dashboard", "", false)).toEqual({
      type: "redirect",
      to: "/login?next=%2Fdashboard",
    });
    expect(decideAccess("/admin/x", "?a=1&b=2", false)).toEqual({
      type: "redirect",
      to: "/login?next=%2Fadmin%2Fx%3Fa%3D1%26b%3D2",
    });
  });

  it("lets signed-in users through", () => {
    expect(decideAccess("/dashboard", "", true)).toEqual({ type: "allow" });
  });

  it("never blocks public pages", () => {
    expect(decideAccess("/", "", false)).toEqual({ type: "allow" });
    expect(decideAccess("/companies/infosys", "", false)).toEqual({ type: "allow" });
    expect(decideAccess("/login", "", false)).toEqual({ type: "allow" });
  });
});
