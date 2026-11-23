import { createClient } from "@supabase/supabase-js";
import { confirmedStaging, stagingFetch, stagingOrigin, verifyStagingRobots } from "./lib/staging-target.mjs";

const env = process.env;
try {
  const base = confirmedStaging(env);
  const supabase = stagingOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_publishable_")) {
    throw new Error("Missing server credential");
  }
  await verifyStagingRobots(base, stagingFetch(base, env.VERCEL_AUTOMATION_BYPASS_SECRET));
  const db = createClient(supabase.href, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(12000) }) },
  });
  const [settings, worker, sources] = await Promise.all([
    db.from("site_settings").select("commerce_enabled,guest_mock_enabled,guest_mock_limit,guest_network_daily_limit,coding_enabled").eq("id", true).single(),
    db.from("worker_heartbeats").select("last_seen").eq("name", "coding").maybeSingle(),
    db.from("recruitment_watch_sources").select("last_success_at,last_error,poll_interval_minutes").eq("enabled", true),
  ]);
  if ([settings, worker, sources].some(result => result.error)) throw new Error("Staging Data API rejected a query");
  const now = Date.now();
  const workerAge = now - Date.parse(worker.data?.last_seen);
  const failing = sources.data.filter(row => row.last_error ||
    !(now - Date.parse(row.last_success_at) < (row.poll_interval_minutes + 30) * 60000)).length;
  const checks = [
    ["Commerce disabled", settings.data.commerce_enabled === false],
    ["Anonymous mocks enabled with positive quotas", settings.data.guest_mock_enabled === true &&
      settings.data.guest_mock_limit > 0 && settings.data.guest_network_daily_limit > 0],
    ["Coding enabled and worker heartbeat current", settings.data.coding_enabled === true && workerAge >= 0 && workerAge < 120000],
    ["Enabled sources have recent successful scans", sources.data.length > 0 && failing === 0],
  ];
  for (const [name, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  console.log(`Enabled sources: ${sources.data.length}. Missing, stale, or failing scans: ${failing}.`);
  if (checks.some(([, pass]) => !pass)) process.exitCode = 1;
} catch {
  console.error("FAIL staging operations probe. Verify the staging target, server credential and Data API access.");
  process.exitCode = 1;
}
