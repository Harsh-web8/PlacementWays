import { confirmedStaging, stagingFetch, verifyStagingRobots } from "./lib/staging-target.mjs";

const env = process.env;
try {
  const base = confirmedStaging(env);
  if ((env.RECRUITMENT_CRON_SECRET ?? "").length < 32) throw new Error("Set the dedicated staging scheduler secret.");
  const fetchStaging = stagingFetch(base, env.VERCEL_AUTOMATION_BYPASS_SECRET);
  await verifyStagingRobots(base, fetchStaging);
  const response = await fetchStaging(new URL("/api/cron/recruitment", base), {
    method: "POST",
    redirect: "error",
    headers: { Authorization: `Bearer ${env.RECRUITMENT_CRON_SECRET}` },
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    console.error(`FAIL recruitment scheduler HTTP ${response.status}`);
    process.exitCode = 1;
  } else {
    const result = await response.json();
    if (!Number.isInteger(result.scanned) || !Array.isArray(result.results) || result.results.length !== result.scanned ||
        result.results.some(item => typeof item?.status !== "string")) {
      throw new Error("Unexpected scheduler response");
    }
    const failed = result.results.filter(item => item.status.startsWith("error:")).length;
    const retrying = result.results.filter(item => item.status.includes("AI extraction will retry")).length;
    console.log(`Scanned ${result.scanned} due sources. ${failed} fetch or queue failures. ${retrying} AI retries scheduled.`);
    if (failed || retrying) process.exitCode = 1;
  }
} catch {
  console.error("FAIL staging scheduler. Verify the isolated target, staging robots policy and scheduler configuration.");
  process.exitCode = 1;
}
