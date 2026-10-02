import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AdminCategory = Tables<"categories">;

/** Every category, parents before children within each parent, for a simple grouped list. */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[admin] could not list categories", { code: error.code });
    return [];
  }
  return data;
}

export async function getAdminCategory(categoryId: string): Promise<AdminCategory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").eq("id", categoryId).maybeSingle();
  if (error) {
    console.error("[admin] could not load category", { code: error.code });
    return null;
  }
  return data;
}
