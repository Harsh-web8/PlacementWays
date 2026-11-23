import { chromium } from "playwright-core";
import { checkGuestFixtures, checkHostedAuth, checkPublicBrowser } from "./lib/staging-browser.mjs";
import { confirmedStaging, stagingFetch, verifyStagingRobots } from "./lib/staging-target.mjs";

const flags = new Set(process.argv.slice(2));
const env = process.env;
let browser;
let step = "Confirm staging target";
try {
  if ([...flags].some(flag => !["--exercise-fixtures", "--auth"].includes(flag))) {
    throw new Error("Supported flags are --exercise-fixtures and --auth.");
  }
  const base = confirmedStaging(env);
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  await verifyStagingRobots(base, stagingFetch(base, bypass));
  if (flags.has("--auth") && !["STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD", "STAGING_STUDENT_EMAIL", "STAGING_STUDENT_PASSWORD"].every(key => env[key])) {
    throw new Error("Set the credentials for the two dedicated staging accounts in the secret environment.");
  }
  step = "Launch Chromium";
  browser = await chromium.launch({ executablePath: env.STAGING_BROWSER_EXECUTABLE || undefined });
  step = "Public browser and offline SQL";
  const metrics = await checkPublicBrowser(browser, base, {}, bypass);
  console.log("PASS public browser, mobile navigation, keyboard access and offline SQL", metrics);
  if (flags.has("--exercise-fixtures")) {
    step = "Anonymous mock, lesson and coding fixtures";
    await checkGuestFixtures(browser, base, { bypass });
    console.log("PASS anonymous mock, lesson and coding fixtures with private results");
  }
  if (flags.has("--auth")) {
    step = "Admin and non-admin access";
    await checkHostedAuth(browser, base, { email: env.STAGING_ADMIN_EMAIL, password: env.STAGING_ADMIN_PASSWORD }, true, bypass);
    await checkHostedAuth(browser, base, { email: env.STAGING_STUDENT_EMAIL, password: env.STAGING_STUDENT_PASSWORD }, false, bypass);
    console.log("PASS admin sign-in and non-admin denial");
  }
} catch (error) {
  // Browser failures can contain page excerpts, credentials, or result paths.
  console.error(step === "Confirm staging target" ? error.message : `FAIL ${step}. Inspect the target in a separate browser session.`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
