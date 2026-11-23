import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";

/** The V1 migration adds these tables; no unverified company content is seeded. */
export type CompanyRole = {
  id: string; company_id: string; slug: string; title: string;
  description: string | null; responsibilities: string | null;
  salary_details: string | null; eligibility: string | null;
  required_skills: string[]; status: string; source_url: string | null; last_verified_at: string | null;
};
export type RecruitmentDrive = {
  id: string; role_id: string; title: string; hiring_year: number | null;
  drive_status: string; status: string; application_url: string | null;
  opens_at: string | null; closes_at: string | null;
  notes: string | null; last_verified_at: string | null; source_url: string | null;
};
export type RecruitmentRound = {
  id: string; drive_id: string; round_number: number; name: string; round_type: string;
  description: string | null; topics: string[]; question_count: number | null;
  duration_minutes: number | null; marking_rules: string | null;
  source_url: string | null; source_kind: string;
};
export type RecruitmentUpdate = {
  id: string; company_id: string; role_id: string | null; drive_id: string | null;
  headline: string; summary: string; source_url: string; published_at: string;
};

export async function listPublicRoles(companyId: string): Promise<CompanyRole[]> {
  if (!readSupabaseEnv().ok) return [];
  const db = await createClient();
  const { data, error } = await db.from("company_roles").select("*")
    .eq("company_id", companyId).eq("status", "published").order("title");
  if (error) { console.error("[recruitment] roles unavailable", error.code); return []; }
  return data ?? [];
}

export const getRoleGuide = cache(async (companyId: string, roleSlug: string) => {
  if (!readSupabaseEnv().ok) return null;
  const db = await createClient();
  const { data: role, error } = await db.from("company_roles").select("*")
    .eq("company_id", companyId).eq("slug", roleSlug).eq("status", "published").maybeSingle();
  if (error) throw new Error("Role information is temporarily unavailable.");
  if (!role) return null;
  const { data: drives, error: driveError } = await db.from("recruitment_drives").select("*, recruitment_rounds(*)")
    .eq("role_id", role.id).eq("status", "published")
    .order("hiring_year", { ascending: false, nullsFirst: false })
    .order("round_number", { referencedTable: "recruitment_rounds" });
  if (driveError) throw new Error("Drive information is temporarily unavailable.");
  const guides = (drives ?? [])
    .map(({ recruitment_rounds, ...drive }) => ({ ...drive, rounds: recruitment_rounds }));
  return { role, drives: guides };
});

export async function listRecruitmentUpdates(companyId?: string, roleId?: string): Promise<RecruitmentUpdate[]> {
  if (!readSupabaseEnv().ok) return [];
  const db = await createClient();
  let q = db.from("recruitment_updates").select("id,company_id,role_id,drive_id,headline,summary,source_url,published_at")
    .eq("is_current",true).order("published_at", { ascending: false }).limit(companyId ? 8 : 60);
  if (companyId) q = q.eq("company_id", companyId);
  if (roleId) q = q.eq("role_id", roleId);
  const { data, error } = await q;
  if (error) { console.error("[recruitment] updates unavailable", error.code); return []; }
  return data ?? [];
}
