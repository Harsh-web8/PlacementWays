/** Pure validation for discovery suggestions. Model output is untrusted, never published here. */
import { z } from "zod";

const roleRecord = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().min(2).max(5000).optional(),
  eligibility: z.string().trim().min(2).max(5000).optional(),
  salary_details: z.string().trim().min(2).max(5000).optional(),
  required_skills: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
}).strict();
const driveRecord = z.object({
  title: z.string().trim().min(3).max(180),
  hiring_year: z.number().int().min(2000).max(2100).optional(),
  notes: z.string().trim().min(2).max(5000).optional(),
  application_url: z.string().url().refine(s=>s.startsWith("https://") && !new URL(s).username && !new URL(s).password).optional(),
}).strict();
const roleSuggestion = z.object({
  kind: z.literal("role"), role: roleRecord, drive: driveRecord.optional(),
  evidence_quote: z.string().trim().min(12).max(1500),
}).strict();
const driveSuggestion = z.object({
  kind: z.literal("drive"), role_title: z.string().trim().min(2).max(150),
  drive: driveRecord, evidence_quote: z.string().trim().min(12).max(1500),
}).strict();
export const discoverySchema = z.array(z.discriminatedUnion("kind",[roleSuggestion,driveSuggestion])).max(6);
export type Discovery = z.infer<typeof discoverySchema>[number];
export { normalizedName, roleSlug } from "@/server/recruitment/discovery-core";
export type { ExistingRole, ExistingDrive, DiscoveryCandidate } from "@/server/recruitment/discovery-core";
import {buildDiscoveryCandidatesValidated, type ExistingRole, type ExistingDrive, type DiscoveryCandidate} from "@/server/recruitment/discovery-core";
/** Validation must finish before calling the scope and duplicate guards. */
export function buildDiscoveryCandidates(input:unknown, sourceText:string, args:{
  companyId:string;roleId:string|null;driveId:string|null;
  roles:ExistingRole[];drives:ExistingDrive[];
}):DiscoveryCandidate[]{
 const parsed=discoverySchema.safeParse(input);
 return parsed.success?buildDiscoveryCandidatesValidated(parsed.data,sourceText,args):[];
}
