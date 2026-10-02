import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AdminCompany = Tables<"companies">;

/** Every company regardless of status -- admins need to see drafts and archived rows too. */
export async function listAdminCompanies(): Promise<AdminCompany[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[admin] could not list companies", { code: error.code });
    return [];
  }
  return data;
}

export async function getAdminCompany(companyId: string): Promise<AdminCompany | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();

  if (error) {
    console.error("[admin] could not load company", { code: error.code });
    return null;
  }
  return data;
}
