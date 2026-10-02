import { z } from "zod";

/**
 * Environment access in one place, validated with Zod.
 *
 * Only NEXT_PUBLIC_* variables are read here. The Supabase "anon" key is
 * designed to be public: it is safe ONLY because Row Level Security is enabled
 * on every table (see supabase/migrations). The service-role key is read only by dedicated server modules and workers.
 */
const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url({ protocol: /^https?$/, message: "must be a valid http(s) URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "looks too short to be a real key"),
});

export type SupabaseEnv =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; problems: string[] };

export function readSupabaseEnv(
  source: Record<string, string | undefined> = {
    // Literal property access so Next can inline these at build time.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): SupabaseEnv {
  const parsed = supabaseSchema.safeParse(source);
  if (parsed.success) {
    return {
      ok: true,
      url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  // Report variable NAMES and reasons only -- never echo values.
  const problems = parsed.error.issues.map(
    (i) => `${String(i.path[0] ?? "env")}: ${i.message}`,
  );
  return { ok: false, problems };
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const env = readSupabaseEnv();
  if (!env.ok) {
    throw new Error(
      `Supabase is not configured. Copy .env.example to .env.local and set: ${env.problems.join("; ")}`,
    );
  }
  return env;
}

/** Public origin of this site, without trailing slash. */
export function getSiteUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  const fallback = "http://localhost:3000";
  const raw = value?.trim() || fallback;
  return raw.replace(/\/+$/, "");
}
