/** Dependency-free, server-side identity/scope guard for reviewable discoveries. */
import { createHash } from "node:crypto";
export type RoleRecord = {title:string;description?:string;eligibility?:string;salary_details?:string;required_skills?:string[]};
export type DriveRecord = {title:string;hiring_year?:number;notes?:string;application_url?:string};
export type DiscoveryItem = {kind:"role";role:RoleRecord;drive?:DriveRecord;evidence_quote:string} |
 {kind:"drive";role_title:string;drive:DriveRecord;evidence_quote:string};
export type ExistingRole = {id:string;title:string;slug:string;company_id:string};
export type ExistingDrive = {id:string;title:string;role_id:string};
export type DiscoveryCandidate = {
  proposal_id?:string; kind:"role"|"drive"; company_id:string;
  parent_role_id:string|null; role_title:string; payload:Record<string,unknown>;
  evidence_quote:string; dedupe_key:string;
};

export function normalizedName(s:string) {return s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");}
export function roleSlug(name:string) {return normalizedName(name).replaceAll(" ","-").slice(0,90).replace(/-$/g,"");}

/** A discovery is eligible only within the monitored source's company/role scope.
 * Unknown role titles are never silently matched to an existing role UUID.
 */
export function buildDiscoveryCandidatesValidated(input:DiscoveryItem[], sourceText:string, args:{
  companyId:string; roleId:string|null; driveId:string|null;
  roles:ExistingRole[]; drives:ExistingDrive[];
}):DiscoveryCandidate[] {
  if(args.driveId)return [];
  const result:DiscoveryCandidate[]=[];
  const dedup=new Set<string>();
  const scopedRole=args.roleId?args.roles.find(r=>r.id===args.roleId&&r.company_id===args.companyId):undefined;
  if(args.roleId&&!scopedRole)return [];
  for(const suggestion of input){
    if(!sourceText.includes(suggestion.evidence_quote))continue;
    const proposedName=suggestion.kind==="role"?suggestion.role.title:suggestion.role_title;
    const roleName=normalizedName(proposedName);
    if(!roleName)continue;
    // Never create a new role from a role-scoped source, and never duplicate an existing one.
    const match=args.roles.find(r=>r.company_id===args.companyId&&
      (normalizedName(r.title)===roleName || r.slug===roleSlug(proposedName)));
    let candidate:DiscoveryCandidate;
    if(suggestion.kind==="role"){
      if(args.roleId || match || !roleSlug(suggestion.role.title))continue;
      const driveName=suggestion.drive?normalizedName(suggestion.drive.title):"";
      const key=createHash("sha256").update(`role|${args.companyId}|${roleName}|${driveName}`).digest("hex");
      candidate={kind:"role",company_id:args.companyId,parent_role_id:null,
        role_title:suggestion.role.title,payload:{role:suggestion.role,...(suggestion.drive?{drive:suggestion.drive}:{})},
        evidence_quote:suggestion.evidence_quote,dedupe_key:key};
    }else{
      const parent=scopedRole??match;
      if(!parent || (args.roleId && match?.id!==args.roleId) ||
         normalizedName(parent.title)!==roleName)continue;
      if(args.drives.some(d=>d.role_id===parent.id&&normalizedName(d.title)===normalizedName(suggestion.drive.title)))continue;
      const key=createHash("sha256").update(`drive|${args.companyId}|${parent.id}|${normalizedName(suggestion.drive.title)}`).digest("hex");
      candidate={kind:"drive",company_id:args.companyId,parent_role_id:parent.id,
        role_title:parent.title,payload:{drive:suggestion.drive},
        evidence_quote:suggestion.evidence_quote,dedupe_key:key};
    }
    if(!dedup.has(candidate.dedupe_key)){dedup.add(candidate.dedupe_key);result.push(candidate);}
  }
  return result;
}
