import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  confirmLinkSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { profileSchema } from "@/lib/validation/profile";

const errorsOf = (r: { success: boolean; error?: z.ZodError }): Record<string, string[] | undefined> =>
  r.error ? (z.flattenError(r.error).fieldErrors as Record<string, string[] | undefined>) : {};

describe("registerSchema", () => {
  const valid = { name: "Asha Rao", email: "Asha@Example.com ", password: "correct1horse", confirmPassword: "correct1horse" };

  it("accepts valid input and normalises the email", () => {
    const r = registerSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("asha@example.com");
      expect(r.data.name).toBe("Asha Rao");
    }
  });

  it("rejects a bad email", () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, email: "not-an-email" })).email).toBeDefined();
  });

  it("enforces the password policy", () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, password: "short1", confirmPassword: "short1" })).password).toBeDefined();
    expect(errorsOf(registerSchema.safeParse({ ...valid, password: "onlyletters", confirmPassword: "onlyletters" })).password).toBeDefined();
    expect(errorsOf(registerSchema.safeParse({ ...valid, password: "12345678", confirmPassword: "12345678" })).password).toBeDefined();
  });

  it("rejects passwords over 72 bytes (bcrypt truncation), counting multi-byte characters", () => {
    const long = "a1" + "x".repeat(71);
    expect(errorsOf(registerSchema.safeParse({ ...valid, password: long, confirmPassword: long })).password).toBeDefined();
    const multibyte = "a1" + "é".repeat(36); // 2 + 72 bytes
    expect(errorsOf(registerSchema.safeParse({ ...valid, password: multibyte, confirmPassword: multibyte })).password).toBeDefined();
  });

  it("requires matching confirmation", () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, confirmPassword: "different1" })).confirmPassword).toBeDefined();
  });

  it("rejects too-short and too-long names", () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, name: "A" })).name).toBeDefined();
    expect(errorsOf(registerSchema.safeParse({ ...valid, name: "A".repeat(101) })).name).toBeDefined();
  });

  it("ignores unknown fields such as a smuggled role", () => {
    const r = registerSchema.safeParse({ ...valid, role: "admin" });
    expect(r.success).toBe(true);
    if (r.success) expect("role" in r.data).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not apply password-strength rules", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
  });
});

describe("forgot / reset password", () => {
  it("normalises email", () => {
    const r = forgotPasswordSchema.safeParse({ email: "  USER@Example.COM " });
    expect(r.success && r.data.email).toBe("user@example.com");
  });
  it("applies the policy on reset", () => {
    expect(resetPasswordSchema.safeParse({ password: "weak", confirmPassword: "weak" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "strong123", confirmPassword: "strong123" }).success).toBe(true);
  });
});

describe("confirmLinkSchema", () => {
  it("accepts known OTP types only", () => {
    expect(confirmLinkSchema.safeParse({ token_hash: "abc", type: "recovery" }).success).toBe(true);
    expect(confirmLinkSchema.safeParse({ token_hash: "abc", type: "signup" }).success).toBe(true);
    expect(confirmLinkSchema.safeParse({ token_hash: "abc", type: "sms" }).success).toBe(false);
    expect(confirmLinkSchema.safeParse({ token_hash: "", type: "email" }).success).toBe(false);
    expect(confirmLinkSchema.safeParse({ type: "email" }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("turns blank optional fields into null", () => {
    const r = profileSchema.safeParse({ name: "Asha", college: "  ", degree: "", graduationYear: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ name: "Asha", college: null, degree: null, graduationYear: null });
  });
  it("parses a graduation year", () => {
    const r = profileSchema.safeParse({ name: "Asha", college: "X", degree: "B.Tech", graduationYear: "2027" });
    expect(r.success && r.data.graduationYear).toBe(2027);
  });
  it.each(["27", "abcd", "1990", "2101", "20277"])("rejects graduation year %s", (y) => {
    expect(profileSchema.safeParse({ name: "Asha", college: "", degree: "", graduationYear: y }).success).toBe(false);
  });
  it("enforces length limits matching the database constraints", () => {
    expect(profileSchema.safeParse({ name: "Asha", college: "c".repeat(151), degree: "", graduationYear: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Asha", college: "", degree: "d".repeat(101), graduationYear: "" }).success).toBe(false);
  });
});
