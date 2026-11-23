import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";

/**
 * DATA ACCESS LAYER for public company content. Companies are managed
 * entirely through the admin dashboard (Phase 4) and stored in the
 * database -- nothing about a company is hardcoded in the frontend, per
 * the project's development rules.
 */

export type CompanyCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

/**
 * Published companies for public listing pages (homepage, /companies).
 *
 * Never throws: a fresh clone without Supabase configured yet renders an
 * empty list and an honest empty state instead of crashing the homepage,
 * and a database-level error is returned as `{ error }` by the Supabase
 * client rather than thrown, so it is handled below without a try/catch.
 * Row Level Security also restricts anonymous readers to published rows
 * only, so this is a defence-in-depth filter, not the only one.
 */
export const getPublishedCompanies = cache(async (): Promise<CompanyCard[]> => {
  if (!readSupabaseEnv().ok) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, description")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[companies] could not load published companies", {
      code: error.code,
    });
    return [];
  }
  return data ?? [];
});

export const getPublishedCompany = cache(async (slug: string) => {
  if (!readSupabaseEnv().ok) return null;
  const db = await createClient();
  const { data: company, error } = await db
    .from("companies")
    .select(
      "id, name, slug, description, website_url, seo_title, seo_description",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("Company information is temporarily unavailable.");
  if (!company) return null;
  const { data: processes, error: processError } = await db
    .from("recruitment_processes")
    .select(
      "id, title, description, hiring_year, drive_name, eligibility, last_verified_on, process_stages(id, name, description, topics, stage_order, duration_minutes, question_count), process_sources(id, label, url, sort_order)",
    )
    .eq("company_id", company.id)
    .eq("status", "published")
    .order("hiring_year", { ascending: false });
  if (processError)
    throw new Error("Recruitment information is temporarily unavailable.");
  return { ...company, processes: processes ?? [] };
});
