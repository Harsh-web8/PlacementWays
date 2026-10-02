import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { slugify } from "@/lib/utils";

/**
 * Finds or creates tags by name, returning a slug -> id map. A rare race
 * between two admins creating the same brand-new tag at once surfaces as an
 * error the caller turns into "please try again" -- the same approach used
 * for stage/source ordering elsewhere, rather than a database upsert we
 * can't exercise against a real PostgREST instance in this environment.
 */
export async function resolveTagIdMap(supabase: SupabaseClient<Database>, names: string[]): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>(); // slug -> display name (first mention wins)
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, name.slice(0, 60));
  }
  if (bySlug.size === 0) return new Map();

  const slugs = [...bySlug.keys()];
  const { data: existing, error: selectError } = await supabase.from("tags").select("id, slug").in("slug", slugs);
  if (selectError) throw new Error("Could not look up tags.");

  const found = new Map((existing ?? []).map((t) => [t.slug, t.id]));
  const missing = slugs.filter((s) => !found.has(s));

  if (missing.length > 0) {
    const { data: created, error: insertError } = await supabase
      .from("tags")
      .insert(missing.map((slug) => ({ name: bySlug.get(slug)!, slug })))
      .select("id, slug");
    if (insertError) throw new Error("Could not create new tags.");
    for (const t of created ?? []) found.set(t.slug, t.id);
  }

  return found;
}

/** Convenience wrapper for callers (like the single-question form) that just want the ids, order-independent. */
export async function resolveTagIds(supabase: SupabaseClient<Database>, names: string[]): Promise<string[]> {
  return [...(await resolveTagIdMap(supabase, names)).values()];
}
