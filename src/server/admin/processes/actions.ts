"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { processSchema, stageSchema, sourceSchema } from "@/lib/validation/recruitment-process";
import { requireAdmin } from "@/server/auth/session";
import { logAdminAction } from "@/server/admin/audit";
import type { Enums } from "@/types/database";

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors;

type ProcessStatus = Enums<"content_status">;
const PROCESS_STATUSES: readonly ProcessStatus[] = ["draft", "published", "archived"];

function revalidateProcess(processId: string, companyId: string) {
  revalidatePath(`/admin/processes/${processId}`);
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/", "layout");
}

/**
 * The publish-gate rules (see migration 3) raise a human-readable message
 * with SQLSTATE 23514, but a plain "published needs a verification date"
 * violation is a CHECK constraint with Postgres's own technical wording --
 * translate that one case, and pass the rest through as written.
 */
function friendlyProcessError(error: PostgrestError): string {
  if (error.message?.includes("processes_published_needs_verification")) {
    return "Add a \u201clast verified\u201d date before publishing this process.";
  }
  if (error.code === "23514") {
    return error.message || "This process isn't ready for that change yet.";
  }
  return "We couldn't save that change. Please try again.";
}

// ---------------------------------------------------------------- process --

function readProcessForm(formData: FormData) {
  return {
    title: field(formData, "title"),
    description: field(formData, "description"),
    hiringYear: field(formData, "hiringYear"),
    driveName: field(formData, "driveName"),
    eligibility: field(formData, "eligibility"),
    lastVerifiedOn: field(formData, "lastVerifiedOn"),
  };
}

export async function createProcess(companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readProcessForm(formData);
  const parsed = processSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruitment_processes")
    .insert({
      company_id: companyId,
      title: parsed.data.title,
      description: parsed.data.description,
      hiring_year: parsed.data.hiringYear,
      drive_name: parsed.data.driveName,
      eligibility: parsed.data.eligibility,
      last_verified_on: parsed.data.lastVerifiedOn,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[admin] could not create recruitment process", { code: error?.code });
    return { status: "error", message: "We couldn't create the process. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "process.create", "recruitment_process", data.id, { companyId, title: parsed.data.title });
  revalidateProcess(data.id, companyId);
  redirect(`/admin/processes/${data.id}`);
}

export async function updateProcess(processId: string, companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readProcessForm(formData);
  const parsed = processSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruitment_processes")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      hiring_year: parsed.data.hiringYear,
      drive_name: parsed.data.driveName,
      eligibility: parsed.data.eligibility,
      last_verified_on: parsed.data.lastVerifiedOn,
    })
    .eq("id", processId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) return { status: "error", message: friendlyProcessError(error), values: raw };
    console.error("[admin] could not update recruitment process", { processId });
    return { status: "error", message: "We couldn't save the process. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "process.update", "recruitment_process", processId, { title: parsed.data.title });
  revalidateProcess(processId, companyId);
  return { status: "success", message: "Process saved.", values: raw };
}

export async function setProcessStatus(
  processId: string,
  companyId: string,
  status: ProcessStatus,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  if (!PROCESS_STATUSES.includes(status)) return { status: "error", message: "Invalid status." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("recruitment_processes").update({ status }).eq("id", processId).select("id").maybeSingle();
  if (error) {
    console.error("[admin] could not update process status", { code: error.code });
    return { status: "error", message: friendlyProcessError(error) };
  }

  if (!data) return { status: "error", message: "This process no longer exists or is unavailable." };

  await logAdminAction(supabase, admin.id, `process.${status}`, "recruitment_process", processId);
  revalidateProcess(processId, companyId);
  return { status: "success" };
}

export async function deleteProcess(processId: string, companyId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("recruitment_processes").delete().eq("id", processId);
  if (error) {
    console.error("[admin] could not delete recruitment process", { code: error.code });
    return { status: "error", message: "We couldn't delete this process. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "process.delete", "recruitment_process", processId, { companyId });
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/", "layout");
  redirect(`/admin/companies/${companyId}`);
}

// ------------------------------------------------------------------ stage --

function readStageForm(formData: FormData) {
  return {
    name: field(formData, "name"),
    stageType: field(formData, "stageType"),
    description: field(formData, "description"),
    topics: field(formData, "topics"),
    durationMinutes: field(formData, "durationMinutes"),
    questionCount: field(formData, "questionCount"),
  };
}

export async function addStage(processId: string, companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readStageForm(formData);
  const parsed = stageSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data: existing, error: countError } = await supabase
    .from("process_stages")
    .select("stage_order")
    .eq("recruitment_process_id", processId)
    .order("stage_order", { ascending: false })
    .limit(1);

  if (countError) {
    console.error("[admin] could not read existing stages", { code: countError.code });
    return { status: "error", message: "We couldn't add the stage. Please try again.", values: raw };
  }
  const nextOrder = (existing[0]?.stage_order ?? 0) + 1;

  const { error } = await supabase.from("process_stages").insert({
    recruitment_process_id: processId,
    name: parsed.data.name,
    stage_type: parsed.data.stageType,
    description: parsed.data.description,
    topics: parsed.data.topics,
    duration_minutes: parsed.data.durationMinutes,
    question_count: parsed.data.questionCount,
    stage_order: nextOrder,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "That stage order is already taken -- please try again.", values: raw };
    }
    console.error("[admin] could not add stage", { code: error.code });
    return { status: "error", message: "We couldn't add the stage. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "stage.create", "process_stage", processId, { name: parsed.data.name });
  revalidateProcess(processId, companyId);
  return { status: "success" };
}

export async function updateStage(stageId: string, processId: string, companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readStageForm(formData);
  const parsed = stageSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("process_stages")
    .update({
      name: parsed.data.name,
      stage_type: parsed.data.stageType,
      description: parsed.data.description,
      topics: parsed.data.topics,
      duration_minutes: parsed.data.durationMinutes,
      question_count: parsed.data.questionCount,
    })
    .eq("id", stageId);

  if (error) {
    console.error("[admin] could not update stage", { code: error.code });
    return { status: "error", message: "We couldn't save the stage. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "stage.update", "process_stage", stageId, { name: parsed.data.name });
  revalidateProcess(processId, companyId);
  return { status: "success", message: "Stage saved.", values: raw };
}

export async function deleteStage(
  stageId: string,
  processId: string,
  companyId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("process_stages").delete().eq("id", stageId);
  if (error) {
    console.error("[admin] could not delete stage", { code: error.code });
    return { status: "error", message: "We couldn't remove that stage. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "stage.delete", "process_stage", stageId, { processId });
  revalidateProcess(processId, companyId);
  return { status: "success" };
}

export async function moveStage(
  stageId: string,
  processId: string,
  companyId: string,
  direction: "up" | "down",
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_process_stage", { p_stage_id: stageId, p_direction: direction });
  if (error) {
    console.error("[admin] could not reorder stage", { code: error.code });
    return { status: "error", message: "We couldn't reorder that stage. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "stage.reorder", "process_stage", stageId, { direction });
  revalidateProcess(processId, companyId);
  return { status: "success" };
}

// ----------------------------------------------------------------- source --

function readSourceForm(formData: FormData) {
  return { label: field(formData, "label"), url: field(formData, "url") };
}

export async function addSource(processId: string, companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readSourceForm(formData);
  const parsed = sourceSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("process_sources")
    .select("sort_order")
    .eq("recruitment_process_id", processId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (readError) return { status: "error", message: "We couldn't load existing sources. Please try again.", values: raw };

  const { error } = await supabase.from("process_sources").insert({
    recruitment_process_id: processId,
    label: parsed.data.label,
    url: parsed.data.url,
    sort_order: (existing[0]?.sort_order ?? -1) + 1,
  });

  if (error) {
    console.error("[admin] could not add source", { code: error.code });
    return { status: "error", message: "We couldn't add that source. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "source.create", "process_source", processId, { label: parsed.data.label });
  revalidateProcess(processId, companyId);
  return { status: "success" };
}

export async function deleteSource(
  sourceId: string,
  processId: string,
  companyId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("process_sources").delete().eq("id", sourceId);
  if (error) {
    console.error("[admin] could not delete source", { code: error.code });
    return { status: "error", message: friendlyProcessError(error) };
  }

  await logAdminAction(supabase, admin.id, "source.delete", "process_source", sourceId, { processId });
  revalidateProcess(processId, companyId);
  return { status: "success" };
}
