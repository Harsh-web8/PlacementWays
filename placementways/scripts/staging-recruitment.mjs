import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { RECRUITMENT_FIXTURE, recruitmentPhaseChecks } from "./lib/staging-recruitment.mjs";
import { confirmedStaging, stagingFetch, stagingOrigin, verifyStagingRobots } from "./lib/staging-target.mjs";

const env = process.env;
const phase = process.argv[2];
let step = "Validate staging configuration";
try {
  if (!["pending", "approved", "rolled-back"].includes(phase)) throw new Error("Choose pending, approved, or rolled-back.");
  const base = confirmedStaging(env);
  const supabase = stagingOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!z.uuid().safeParse(env.STAGING_PROPOSAL_ID).success) throw new Error("Set STAGING_PROPOSAL_ID to the synthetic proposal UUID.");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.STAGING_ADMIN_EMAIL || !env.STAGING_ADMIN_PASSWORD) {
    throw new Error("Set the staging publishable key and dedicated administrator credentials.");
  }
  await verifyStagingRobots(base, stagingFetch(base, env.VERCEL_AUTOMATION_BYPASS_SECRET));
  step = "Sign in to staging Supabase as a dedicated admin";
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(12000) }) },
  };
  const admin = createClient(supabase.href, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  const reader = createClient(supabase.href, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  const { error } = await admin.auth.signInWithPassword({ email: env.STAGING_ADMIN_EMAIL, password: env.STAGING_ADMIN_PASSWORD });
  if (error) throw error;
  try {
    const identity = await admin.rpc("is_admin");
    if (identity.error || identity.data !== true) throw new Error("Administrator required");
    step = "Read recruitment evidence and anonymous visibility";
    const id = env.STAGING_PROPOSAL_ID;
    const results = await Promise.all([
      admin.from("recruitment_change_proposals").select("company_id,role_id,drive_id,status,observed_excerpt").eq("id", id).maybeSingle(),
      admin.from("recruitment_field_changes").select("target_kind,target_id,field_key,old_value,new_value,evidence_quote").eq("proposal_id", id),
      reader.from("recruitment_rounds").select("duration_minutes").eq("id", RECRUITMENT_FIXTURE.round).maybeSingle(),
      reader.from("recruitment_updates").select("is_current").eq("proposal_id", id).maybeSingle(),
      admin.from("recruitment_updates").select("is_current").eq("proposal_id", id).maybeSingle(),
      admin.from("audit_logs").select("action").eq("entity_type", "recruitment_change_proposal").eq("entity_id", id),
    ]);
    if (results.some(result => result.error)) throw new Error("Staging Data API rejected a query");
    const [proposal, fields, publicRound, publicUpdate, history, logs] = results.map(result => result.data);
    const checks = recruitmentPhaseChecks(phase, { proposal, fields, publicRound, publicUpdate, history, audit: logs.map(log => log.action) });
    for (const [name, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
    if (checks.some(([, pass]) => !pass)) process.exitCode = 1;
  } finally {
    await admin.auth.signOut({ scope: "local" });
  }
} catch (error) {
  console.error(step === "Validate staging configuration" && error instanceof Error ? error.message : `FAIL ${step}.`);
  process.exitCode = 1;
}
