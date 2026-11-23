/** Pure candidate validation: AI output is untrusted and MUST be admin-approved. */
import { z } from "zod";
import { discoverySchema } from "@/server/recruitment/discovery";

const roleFields = ["title", "description", "responsibilities", "salary_details", "eligibility", "required_skills"] as const;
const driveFields = ["title", "notes", "application_url", "opens_at", "closes_at", "drive_status"] as const;
const roundFields = ["name", "round_type", "description", "topics", "question_count", "duration_minutes", "marking_rules"] as const;
export type TargetKind = "role" | "drive" | "round" | "round_new";
export type RoundSummary = { id: string; round_number: number; name: string; round_type: string; description: string | null; topics: string[]; question_count: number | null; duration_minutes: number | null; marking_rules: string | null };
export type Scope = {
  role: Record<string, unknown> | null;
  drive: Record<string, unknown> | null;
  rounds: RoundSummary[];
};

const suggestion = z.object({
  target_kind: z.enum(["role", "drive", "round", "round_new"]),
  round_number: z.number().int().min(1).max(30).optional(),
  field_key: z.string().min(1).max(50),
  value: z.unknown(),
  evidence_quote: z.string().trim().min(8).max(1500),
}).strict();
export const aiRecruitmentSchema = z.object({
  headline: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(1).max(5000),
  evidence: z.string().trim().min(1).max(4000),
  classification: z.enum(["new_vacancy", "deadline", "eligibility", "exam_pattern", "schedule", "results", "closure", "source_change"]),
  field_changes: z.array(suggestion).max(12).default([]),
  discoveries: discoverySchema.default([]),
}).strict();

export type Candidate = {
  target_kind: TargetKind;
  target_id: string;
  field_key: string;
  old_value: unknown;
  new_value: unknown;
  evidence_quote: string;
};

/** Returns null for unsupported/malformed values; clearing a field is not AI-automated. */
export function validatedFieldValue(target: TargetKind, field: string, value: unknown): unknown | null {
  const allowed = target === "role" ? roleFields : target === "drive" ? driveFields : roundFields;
  if (target === "round_new") {
    const obj = z.object({
      round_number: z.number().int().min(1).max(30),
      name: z.string().trim().min(2).max(150),
      round_type: z.enum(["screening", "assessment", "coding", "interview", "hr", "other"]).default("assessment"),
      description: z.string().max(5000).optional(),
      topics: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
      question_count: z.number().int().min(0).max(10000).optional(),
      duration_minutes: z.number().int().min(1).max(1440).optional(),
      marking_rules: z.string().max(3000).optional(),
    }).strict().safeParse(value);
    return field === "create" && obj.success ? obj.data : null;
  }
  if (!(allowed as readonly string[]).includes(field)) return null;
  if (field === "topics" || field === "required_skills") {
    const parsed = z.array(z.string().trim().min(1).max(100)).min(1).max(50).safeParse(value);
    return parsed.success ? [...new Set(parsed.data)] : null;
  }
  if (field === "question_count" || field === "duration_minutes") {
    const parsed = z.number().int().min(field === "question_count" ? 0 : 1).max(field === "question_count" ? 10000 : 1440).safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  if (field === "drive_status") {
    return ["unknown", "upcoming", "open", "closed", "cancelled", "completed"].includes(value as string) ? value : null;
  }
  if (field === "round_type") {
    return ["screening", "assessment", "coding", "interview", "hr", "other"].includes(value as string) ? value : null;
  }
  if (field === "application_url") {
    if (typeof value !== "string" || value.length > 1000) return null;
    try {const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;} catch {return null;}
  }
  if (field === "opens_at" || field === "closes_at") {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
    const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const max = field === "title" || field === "name" ? 150 : 5000;
  const parsed = z.string().trim().min(2).max(max).safeParse(value);
  return parsed.success ? parsed.data : null;
}

const equals = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Scope is chosen from DB context, never from an untrusted AI-selected UUID. */
export function makeFieldCandidates(
  raw: unknown, sourceText: string, scope: Scope,
  roleId: string | null, driveId: string | null,
): Candidate[] {
  const parsed = aiRecruitmentSchema.safeParse(raw);
  if (!parsed.success) return [];
  const result: Candidate[] = [];
  const dedup = new Set<string>();
  for (const entry of parsed.data.field_changes) {
    if (!sourceText.includes(entry.evidence_quote)) continue;
    if (entry.target_kind === "role" && (!roleId || !scope.role)) continue;
    if ((entry.target_kind === "drive" || entry.target_kind === "round" || entry.target_kind === "round_new") && (!driveId || !scope.drive)) continue;
    const round = entry.target_kind === "round" ? scope.rounds.find(r => r.round_number === entry.round_number) : undefined;
    if (entry.target_kind === "round" && !round) continue;
    if (entry.target_kind === "round_new" && (entry.field_key !== "create" || typeof entry.round_number !== "number" || scope.rounds.some(r => r.round_number === entry.round_number))) continue;
    const targetId = entry.target_kind === "role" ? roleId : entry.target_kind === "drive" || entry.target_kind === "round_new" ? driveId : round?.id;
    if (!targetId) continue;
    const value = validatedFieldValue(entry.target_kind, entry.field_key, entry.value);
    if (value === null) continue;
    if (entry.target_kind === "round_new") {
      const object = value as { round_number: number };
      if (object.round_number !== entry.round_number) continue;
    }
    const old = entry.target_kind === "role" ? scope.role?.[entry.field_key] : entry.target_kind === "drive" ? scope.drive?.[entry.field_key] : entry.target_kind === "round" ? (round as unknown as Record<string, unknown>)[entry.field_key] : null;
    if (equals(old, value)) continue;
    const fieldKey=entry.target_kind==="round_new"?`create_${entry.round_number}`:entry.field_key;
    const key = `${entry.target_kind}:${targetId}:${fieldKey}`;
    if (dedup.has(key)) continue;
    dedup.add(key);
    result.push({target_kind:entry.target_kind,target_id:targetId,field_key:fieldKey,old_value:old ?? null,new_value:value,evidence_quote:entry.evidence_quote});
  }
  return result;
}
