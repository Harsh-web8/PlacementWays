"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth/session";
import { scanRecruitmentSources } from "@/server/recruitment/monitor";

export type AdminResult = { ok: boolean; message: string };
const uuid = z.uuid();
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const adminDB = async () => (await createClient()) as unknown as SupabaseClient;

export async function addRecruitmentRole(_previous:AdminResult, form:FormData):Promise<AdminResult> {
  await requireAdmin();
  const parsed = z.object({company_id:uuid,slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(90),title:z.string().min(2).max(150),description:z.string().max(5000),eligibility:z.string().max(5000)}).safeParse({
    company_id:text(form,"company_id"), slug:text(form,"slug"), title:text(form,"title"),
    description:text(form,"description"), eligibility:text(form,"eligibility"),
  });
  if (!parsed.success) return {ok:false,message:"Enter a valid company, role title and lowercase hyphenated slug."};
  const db=await adminDB();
  const {error}=await db.from("company_roles").insert({...parsed.data,status:"published"});
  if(error)return {ok:false,message:`Unable to save role (${error.code}).`};
  revalidatePath("/companies","layout");
  return {ok:true,message:"Role saved. Add a reviewed hiring drive and assessment rounds next."};
}

export async function addRecruitmentDrive(_previous:AdminResult,form:FormData):Promise<AdminResult>{
  await requireAdmin();
  const parsed=z.object({role_id:uuid,title:z.string().min(3).max(180),hiring_year:z.coerce.number().int().min(2000).max(2100),notes:z.string().max(5000)}).safeParse({
    role_id:text(form,"role_id"), title:text(form,"title"),hiring_year:text(form,"hiring_year"),notes:text(form,"notes"),
  });
  if(!parsed.success)return {ok:false,message:"Select a role and provide a valid hiring year, title and notes."};
  const db=await adminDB();const {error}=await db.from("recruitment_drives").insert({...parsed.data,status:"published",drive_status:"upcoming"});
  if(error)return {ok:false,message:`Unable to save drive (${error.code}).`};
  revalidatePath("/companies","layout");
  return {ok:true,message:"Recruitment drive created. Add only source-supported facts to its rounds."};
}

export async function addRecruitmentRound(_previous:AdminResult,form:FormData):Promise<AdminResult>{
  await requireAdmin();
  const parsed=z.object({drive_id:uuid,round_number:z.coerce.number().int().min(1).max(30),name:z.string().min(2).max(150),description:z.string().max(5000),source_url:z.url().refine(s=>s.startsWith("https://"))}).safeParse({
    drive_id:text(form,"drive_id"),round_number:text(form,"round_number"),name:text(form,"name"),
    description:text(form,"description"),source_url:text(form,"source_url"),
  });
  if(!parsed.success)return {ok:false,message:"Provide a drive, stage number, name and a supporting HTTPS source URL."};
  const db=await adminDB();const {error}=await db.from("recruitment_rounds").insert({...parsed.data,source_kind:"unverified"});
  if(error)return {ok:false,message:`Unable to save round (${error.code}).`};
  revalidatePath("/companies","layout");
  return {ok:true,message:"Assessment stage published with an evidence link and unverified status. Verify the source before labeling it official."};
}

export async function addWatchSource(_previous:AdminResult,form:FormData):Promise<AdminResult>{
  await requireAdmin();
  const parsed=z.object({company_id:uuid,role_id:z.union([uuid,z.literal("")]),drive_id:z.union([uuid,z.literal("")]),label:z.string().min(3).max(140),poll_interval_minutes:z.coerce.number().int().min(30).max(10080),source_url:z.url().refine(s=>s.startsWith("https://")&& !new URL(s).username && !new URL(s).password)}).safeParse({
    company_id:text(form,"company_id"),role_id:text(form,"role_id"),drive_id:text(form,"drive_id"),label:text(form,"label"),poll_interval_minutes:text(form,"poll_interval_minutes")||"360",source_url:text(form,"source_url"),
  });
  if(!parsed.success)return {ok:false,message:"Choose a company and enter a label and official HTTPS source URL."};
  const db=await adminDB();
  if(parsed.data.drive_id && !parsed.data.role_id)return {ok:false,message:"Select a parent role when registering a drive-specific source."};
  if(parsed.data.role_id){
    const {data:role}=await db.from("company_roles").select("id").eq("id",parsed.data.role_id).eq("company_id",parsed.data.company_id).maybeSingle();
    if(!role)return {ok:false,message:"The selected role must belong to the selected company."};
  }
  if(parsed.data.drive_id){
    const {data:drive}=await db.from("recruitment_drives").select("id").eq("id",parsed.data.drive_id).eq("role_id",parsed.data.role_id).maybeSingle();
    if(!drive)return {ok:false,message:"The selected drive must belong to the selected role."};
  }
  const {error}=await db.from("recruitment_watch_sources").insert({...parsed.data,role_id:parsed.data.role_id||null,drive_id:parsed.data.drive_id||null});
  if(error)return {ok:false,message:`Unable to add source (${error.code}). Check duplicates and apply the migration.`};
  revalidatePath("/admin/recruitment");
  return {ok:true,message:"Source saved. Add its hostname to RECRUITMENT_ALLOWED_HOSTS before scanning."};
}

export async function decideRecruitmentProposal(id:string,approve:boolean):Promise<void>{
  await requireAdmin();
  if(!uuid.safeParse(id).success)throw new Error("Invalid proposal");
  const db=await adminDB();
  const {error}=await db.rpc("approve_recruitment_proposal",{p_proposal_id:id,p_approve:approve});
  if(error)throw new Error(`Approval could not be published (${error.code}).`);
  revalidatePath("/admin/recruitment");
  revalidatePath("/recruitment");
  revalidatePath("/companies","layout");
}

export async function scanSourcesNow():Promise<void>{
  await requireAdmin();
  await scanRecruitmentSources(3);
  revalidatePath("/admin/recruitment");
}

/** Attach a human-reviewed, evidence-backed typed change to a pending proposal. */
export async function addReviewedFieldChange(_previous:AdminResult,form:FormData):Promise<AdminResult>{
  await requireAdmin();
  const parsed=z.object({
    proposal_id:uuid,
    target_kind:z.enum(["role","drive","round","round_new"]),
    target_id:uuid,
    field_key:z.string().trim().min(1).max(50),
    value:z.string().trim().min(1).max(6000),
    evidence_quote:z.string().trim().min(8).max(1500),
  }).safeParse({
    proposal_id:text(form,"proposal_id"),target_kind:text(form,"target_kind"),target_id:text(form,"target_id"),
    field_key:text(form,"field_key"),value:text(form,"value"),evidence_quote:text(form,"evidence_quote"),
  });
  if(!parsed.success)return {ok:false,message:"Provide a proposed field, value and exact supporting source quote."};
  const p=parsed.data; const db=await adminDB();
  const {data:proposal,error:proposalError}=await db.from("recruitment_change_proposals")
    .select("id,status,role_id,drive_id,company_id,observed_excerpt,evidence")
    .eq("id",p.proposal_id).maybeSingle();
  if(proposalError || !proposal || proposal.status!=="pending")return {ok:false,message:"Only pending recruitment proposals can be edited."};
  if(!(proposal.observed_excerpt||proposal.evidence||"").includes(p.evidence_quote))
    return {ok:false,message:"The evidence quote must appear exactly in the captured source snapshot."};
  let newValue:unknown;
  try { newValue=JSON.parse(p.value); }
  catch { newValue=p.value; }
  const {validatedFieldValue}=await import("@/server/recruitment/structured");
  newValue=validatedFieldValue(p.target_kind,p.field_key,newValue);
  if(newValue===null)return {ok:false,message:"Value does not match the selected field type. Use a JSON array for topics or a JSON object for new rounds."};
  let oldValue:unknown=null;
  if(p.target_kind==="role"){
    if(p.target_id!==proposal.role_id)return {ok:false,message:"Role does not match this monitored source."};
    const {data}=await db.from("company_roles").select("*").eq("id",p.target_id).eq("company_id",proposal.company_id).maybeSingle();
    if(!data)return {ok:false,message:"Role not found in selected company."};
    oldValue=data[p.field_key]??null;
  }else if(p.target_kind==="drive" || p.target_kind==="round_new"){
    if(p.target_id!==proposal.drive_id)return {ok:false,message:"Drive does not match this monitored source."};
    const {data}=await db.from("recruitment_drives").select("*").eq("id",p.target_id).eq("role_id",proposal.role_id).maybeSingle();
    if(!data)return {ok:false,message:"Drive not found under selected role."};
    oldValue=p.target_kind==="drive"?data[p.field_key]??null:null;
    if(p.target_kind==="round_new"){
      const {data:existing}=await db.from("recruitment_rounds").select("id").eq("drive_id",p.target_id).eq("round_number",(newValue as {round_number:number}).round_number).maybeSingle();
      if(existing)return {ok:false,message:"A round with this number already exists."};
    }
  }else{
    if(!proposal.drive_id)return {ok:false,message:"Attach this source to a hiring drive before editing rounds."};
    const {data}=await db.from("recruitment_rounds").select("*").eq("id",p.target_id).eq("drive_id",proposal.drive_id).maybeSingle();
    if(!data)return {ok:false,message:"Round not found under this hiring drive."};
    oldValue=data[p.field_key]??null;
  }
  if(JSON.stringify(oldValue)===JSON.stringify(newValue))return {ok:false,message:"New value is already published. No change necessary."};
  const savedField=p.target_kind==="round_new"?`create_${(newValue as {round_number:number}).round_number}`:p.field_key;
  const {error}=await db.from("recruitment_field_changes").upsert({
    proposal_id:p.proposal_id,target_kind:p.target_kind,target_id:p.target_id,field_key:savedField,
    old_value:oldValue,new_value:newValue,evidence_quote:p.evidence_quote,
  },{onConflict:"proposal_id,target_kind,target_id,field_key"});
  if(error)return {ok:false,message:`Could not save the structured change (${error.code}).`};
  revalidatePath("/admin/recruitment");
  return {ok:true,message:"Field change saved. Review its before/after values, then approve the complete proposal."};
}

export async function rollbackRecruitmentProposal(id:string):Promise<void>{
  await requireAdmin();
  if(!uuid.safeParse(id).success)throw new Error("Invalid proposal");
  const db=await adminDB();
  const {error}=await db.rpc("rollback_recruitment_proposal",{p_proposal_id:id});
  if(error)throw new Error(`Rollback failed. Fields may have changed since publication (${error.code}).`);
  revalidatePath("/admin/recruitment");
  revalidatePath("/recruitment");
  revalidatePath("/companies","layout");
}

/** Approving a discovered role/drive is separate from approving a news/field update. */
export async function decideRecruitmentDiscovery(id:string,approve:boolean):Promise<void>{
  await requireAdmin();
  if(!uuid.safeParse(id).success)throw new Error("Invalid discovery candidate");
  const db=await adminDB();
  const {error}=await db.rpc("decide_recruitment_discovery",{p_candidate_id:id,p_approve:approve});
  if(error)throw new Error(`Discovery decision failed (${error.code}). The role/drive may already exist.`);
  revalidatePath("/admin/recruitment");
  revalidatePath("/companies","layout");
  revalidatePath("/recruitment");
}

export async function rollbackRecruitmentDiscovery(id:string):Promise<void>{
  await requireAdmin();
  if(!uuid.safeParse(id).success)throw new Error("Invalid discovery candidate");
  const db=await adminDB();
  const {error}=await db.rpc("rollback_recruitment_discovery",{p_candidate_id:id});
  if(error)throw new Error(`Discovery rollback failed (${error.code}). Dependent content must be archived manually.`);
  revalidatePath("/admin/recruitment");
  revalidatePath("/companies","layout");
  revalidatePath("/recruitment");
}

/** Prevent endlessly retrying broken sources without an administrator's intent. */
export async function setRecruitmentSourceEnabled(id:string,enabled:boolean):Promise<void>{
  await requireAdmin();
  if(!uuid.safeParse(id).success)throw new Error("Invalid monitored source");
  const db=await adminDB();
  const {error}=await db.from("recruitment_watch_sources")
    .update({enabled,next_check_at:enabled?new Date().toISOString():null}).eq("id",id);
  if(error)throw new Error(`Could not change source status (${error.code}).`);
  revalidatePath("/admin/recruitment");
}

export async function retryRecruitmentSource(id:string):Promise<void>{
  await requireAdmin();
  if(!uuid.safeParse(id).success)throw new Error("Invalid monitored source");
  const db=await adminDB();
  const {error}=await db.from("recruitment_watch_sources")
    .update({next_check_at:new Date().toISOString()}).eq("id",id).eq("enabled",true);
  if(error)throw new Error(`Could not schedule source scan (${error.code}).`);
  revalidatePath("/admin/recruitment");
}
