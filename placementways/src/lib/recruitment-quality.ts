/** Evidence and catalog-quality rules shared by the public guides and private editorial dashboard.
 * A recent review is NOT a guarantee that a hiring notice is still current. */
export type ReviewState = "recent" | "stale" | "unknown";
export type ReviewAssessment = { state: ReviewState; label: string; ageDays: number | null };
export const REVIEW_WINDOW_DAYS = 30;

export function assessReviewDate(value: string | null | undefined, now = new Date()): ReviewAssessment {
  if (!value) return { state: "unknown", label: "Review date unavailable", ageDays: null };
  const timestamp = Date.parse(value);
  const nowTime = now.getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowTime) || timestamp > nowTime + 86_400_000)
    return { state: "unknown", label: "Review date unavailable", ageDays: null };
  const ageDays = Math.max(0, Math.floor((nowTime - timestamp) / 86_400_000));
  return ageDays > REVIEW_WINDOW_DAYS
    ? { state: "stale", label: `Last reviewed ${ageDays} days ago — recheck source`, ageDays }
    : { state: "recent", label: `Last reviewed ${ageDays} day${ageDays === 1 ? "" : "s"} ago`, ageDays };
}

export function assessDriveLabel(status: string, closesAt: string | null, now = new Date()): {label:string; warning:boolean} {
  if (status === "unknown") return {label:"Status not confirmed",warning:true};
  if (status === "open") {
    const closeTime = closesAt ? Date.parse(closesAt) : NaN;
    if (Number.isFinite(closeTime) && closeTime < now.getTime())
      return { label:"Listed open · deadline passed; confirm with employer",warning:true };
    return {label:"Listed open · verify source",warning:false};
  }
  return {label:status.replaceAll("_", " "),warning:false};
}

export type QualityCompany = {id:string;name:string;slug:string;status?:string};
export type QualityRole = {id:string;company_id:string;title:string;slug:string;source_url:string|null;last_verified_at:string|null;status?:string};
export type QualityDrive = {id:string;role_id:string;title:string;source_url:string|null;last_verified_at:string|null;status?:string};
export type QualityRound = {id:string;drive_id:string;source_url:string|null};
export type QualitySource = {id:string;company_id:string;label:string;enabled:boolean;last_success_at:string|null;last_error:string|null};
export type QualityIssue = {key:string;severity:"critical"|"high"|"medium";company:string;title:string;explanation:string;href:string};
export type QualityInput = {
  companies:QualityCompany[];roles:QualityRole[];drives:QualityDrive[];
  rounds:QualityRound[];sources:QualitySource[];
};

/** Only evaluate published guides; pending/draft records must not count toward public coverage. */
export function buildRecruitmentQualityReport(input:QualityInput, now = new Date()) {
  const companies = input.companies.filter(c=>!c.status || c.status === "published");
  const companyById = new Map(companies.map(c=>[c.id,c]));
  const roles = input.roles.filter(r=>(!r.status || r.status === "published")&&companyById.has(r.company_id));
  const rolesById = new Map(roles.map(r=>[r.id,r]));
  const drives = input.drives.filter(d=>(!d.status || d.status === "published")&&rolesById.has(d.role_id));
  const driveIds = new Set(drives.map(d=>d.id));
  const rounds = input.rounds.filter(r=>driveIds.has(r.drive_id));
  const sources = input.sources.filter(s=>companyById.has(s.company_id));
  const watchedCompanies=new Set(sources.filter(s=>s.enabled).map(s=>s.company_id));
  const issues:QualityIssue[]=[];
  const add=(key:string,severity:QualityIssue["severity"],company:string,title:string,explanation:string,href:string)=>issues.push({key,severity,company,title,explanation,href});

  for(const company of companies){
    if(!watchedCompanies.has(company.id)) add(`source:${company.id}`,"high",company.name,"No enabled recruitment source","Register a permitted official careers or notices URL; AI monitoring cannot cover unregistered sources.","/admin/recruitment#setup");
    if(!roles.some(r=>r.company_id===company.id)) add(`roles:${company.id}`,"critical",company.name,"No published role guides","Add and review a role. Do not publish invented eligibility or assessment patterns.","/admin/recruitment#setup");
  }
  for(const role of roles){
    const company=companyById.get(role.company_id)!;
    if(!drives.some(d=>d.role_id===role.id))add(`drive:${role.id}`,"high",company.name,`${role.title}: no hiring drive`,"Create a source-supported hiring drive before claiming its selection process is current.","/admin/recruitment#setup");
    const review=assessReviewDate(role.last_verified_at,now);
    if(!role.source_url || review.state !== "recent")add(`role-review:${role.id}`,"high",company.name,`${role.title}: needs source review`,!role.source_url?"Role has no evidence URL.":review.label,"/admin/recruitment#approvals");
  }
  for(const drive of drives){
    const role=rolesById.get(drive.role_id)!;
    const company=companyById.get(role.company_id)!;
    if(!rounds.some(r=>r.drive_id===drive.id))add(`round:${drive.id}`,"high",company.name,`${role.title} / ${drive.title}: no selection rounds`,"Add round-wise test patterns only from reviewed evidence.","/admin/recruitment#approvals");
    const review=assessReviewDate(drive.last_verified_at,now);
    if(!drive.source_url || review.state !== "recent")add(`drive-review:${drive.id}`,"high",company.name,`${drive.title}: verify hiring notice`,!drive.source_url?"Hiring drive has no supporting source URL.":review.label,"/admin/recruitment#approvals");
  }
  for(const round of rounds){
    if(round.source_url)continue;
    const drive=drives.find(d=>d.id===round.drive_id);
    const role=drive?rolesById.get(drive.role_id):null;
    const company=role?companyById.get(role.company_id):null;
    if(company)add(`round-source:${round.id}`,"medium",company.name,"Assessment round lacks direct evidence","Link the original notice or a clearly labeled supporting source.","/admin/recruitment#approvals");
  }
  for(const source of sources.filter(s=>s.enabled)){
    const company=companyById.get(source.company_id)!;
    if(source.last_error)add(`source-error:${source.id}`,"high",company.name,`${source.label}: monitoring error`,"Review the failed source and retry a permitted scan.","/admin/recruitment#sources");
    else if(assessReviewDate(source.last_success_at,now).state!=="recent")add(`source-stale:${source.id}`,"medium",company.name,`${source.label}: not checked recently`,"Check source health and scan schedule.","/admin/recruitment#sources");
  }
  const priority:Record<QualityIssue["severity"],number>={critical:0,high:1,medium:2};
  issues.sort((a,b)=>priority[a.severity]-priority[b.severity]||a.company.localeCompare(b.company)||a.key.localeCompare(b.key));
  return {
    generatedAt:now.toISOString(),
    summary:{companies:companies.length,roles:roles.length,drives:drives.length,rounds:rounds.length,enabledSources:sources.filter(s=>s.enabled).length,issues:issues.length},
    issues,
  };
}
