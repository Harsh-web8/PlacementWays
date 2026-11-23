import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";
import { getPublishedCompanies } from "@/server/companies/queries";
import type { DirectoryCompany } from "@/lib/company-directory";

/** Search data is joined only from published records; drafts must never enter the public directory. */
export const getCompanyDirectory = cache(async (): Promise<DirectoryCompany[]> => {
  const companies = await getPublishedCompanies();
  if (!companies.length || !readSupabaseEnv().ok) return companies.map(c => ({ ...c, roles: [], publishedDriveCount: 0, listedOpenDriveCount: 0 }));

  const db = await createClient();
  const ids = companies.map(c => c.id);
  // RLS and explicit status filters both protect anonymous queries.
  const { data: roles, error: roleError } = await db.from("company_roles")
    .select("id,company_id,title,slug").in("company_id", ids).eq("status", "published").order("title");
  if (roleError) {
    console.error("[directory] roles unavailable", roleError.code);
    return companies.map(c => ({ ...c, roles: [], publishedDriveCount: 0, listedOpenDriveCount: 0 }));
  }

  const roleIds = (roles ?? []).map(r => r.id);
  const { data: drives, error: driveError } = roleIds.length
    ? await db.from("recruitment_drives").select("role_id,drive_status").in("role_id", roleIds).eq("status", "published")
    : { data: [], error: null };
  if (driveError) console.error("[directory] drive summaries unavailable", driveError.code);
  const companyByRole = new Map((roles ?? []).map(r => [r.id, r.company_id]));
  const counts = new Map<string, { total: number; open: number }>();
  for (const drive of drives ?? []) {
    const companyId = companyByRole.get(drive.role_id);
    if (!companyId) continue;
    const count = counts.get(companyId) ?? { total: 0, open: 0 };
    count.total += 1;
    if (drive.drive_status === "open") count.open += 1;
    counts.set(companyId, count);
  }
  return companies.map(c => ({
    ...c,
    roles: (roles ?? []).filter(role => role.company_id === c.id).map(role => ({ slug: role.slug, title: role.title })),
    publishedDriveCount: counts.get(c.id)?.total ?? 0,
    listedOpenDriveCount: counts.get(c.id)?.open ?? 0,
  }));
});
