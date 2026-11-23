import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt (used by Supabase Auth) ignores everything after 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "That email address is too long."));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX_BYTES, {
    message: `Use at most ${PASSWORD_MAX_BYTES} characters.`,
  })
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your name (at least 2 characters).")
      .max(100, "Name must be 100 characters or fewer."),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email,
  // No strength rules on login: never reveal the policy to someone guessing.
  password: z.string().min(1, "Enter your password.").max(1024),
  next: z.string().max(2048).optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

/** The OTP types our /auth/confirm route accepts from email links. */
export const confirmLinkSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["signup", "email", "recovery", "magiclink", "email_change", "invite"]),
  next: z.string().max(2048).optional(),
});
