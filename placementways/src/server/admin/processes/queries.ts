import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AdminProcess = Tables<"recruitment_processes">;
export type AdminStage = Tables<"process_stages">;
export type AdminSource = Tables<"process_sources">;

/** Every recruitment process for a company, regardless of status, newest hiring year first. */
export async function listProcessesForCompany(companyId: string): Promise<AdminProcess[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruitment_processes")
    .select("*")
    .eq("company_id", companyId)
    .order("hiring_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] could not list recruitment processes", { code: error.code });
    return [];
  }
  return data;
}

export type ProcessWithChildren = {
  process: AdminProcess;
  company: Pick<Tables<"companies">, "id" | "name" | "slug">;
  stages: AdminStage[];
  sources: AdminSource[];
};

/** A process plus everything its edit page needs, fetched in parallel rather than nested joins. */
export async function getProcessWithChildren(processId: string): Promise<ProcessWithChildren | null> {
  const supabase = await createClient();

  const { data: process, error: processError } = await supabase
    .from("recruitment_processes")
    .select("*")
    .eq("id", processId)
    .maybeSingle();

  if (processError) {
    console.error("[admin] could not load recruitment process", { code: processError.code });
    return null;
  }
  if (!process) return null;

  const [companyResult, stagesResult, sourcesResult] = await Promise.all([
    supabase.from("companies").select("id, name, slug").eq("id", process.company_id).maybeSingle(),
    supabase.from("process_stages").select("*").eq("recruitment_process_id", processId).order("stage_order", { ascending: true }),
    supabase.from("process_sources").select("*").eq("recruitment_process_id", processId).order("sort_order", { ascending: true }),
  ]);

  if (!companyResult.data) {
    console.error("[admin] recruitment process has no company", { processId });
    return null;
  }

  return {
    process,
    company: companyResult.data,
    stages: stagesResult.data ?? [],
    sources: sourcesResult.data ?? [],
  };
}
