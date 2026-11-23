import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedStaging, stagingFetch, stagingOrigin, verifyStagingRobots } from "../../scripts/lib/staging-target.mjs";
import { openProtectedBrowser } from "../../scripts/lib/staging-browser.mjs";
import { migrationPlan, verifyLinkedStagingDatabase } from "../../scripts/lib/staging-migrations.mjs";
import { RECRUITMENT_FIXTURE as fixture, recruitmentPhaseChecks } from "../../scripts/lib/staging-recruitment.mjs";

const env = {
  DEPLOYMENT_ENV: "staging", STAGING_DB_ISOLATED: "true",
  STAGING_BASE_URL: "https://stage.example.test", NEXT_PUBLIC_SITE_URL: "https://stage.example.test/",
};

test("hosted acceptance requires matching isolated HTTPS targets", () => {
  assert.equal(confirmedStaging(env).origin, env.STAGING_BASE_URL);
  assert.throws(() => confirmedStaging({ ...env, DEPLOYMENT_ENV: "production" }));
  assert.throws(() => confirmedStaging({ ...env, STAGING_DB_ISOLATED: "" }));
  assert.throws(() => confirmedStaging({ ...env, NEXT_PUBLIC_SITE_URL: "https://another.example.test/" }));
  for (const invalid of ["https://user:secret@stage.example.test", "https://stage.example.test/elsewhere",
    "https://stage.example.test/?q=fixture", "https://stage.example.test/#fixture", "http://stage.example.test/"]) {
    assert.throws(() => stagingOrigin(invalid));
  }
});

test("loopback is available for HTTP smoke only with explicit opt-in", () => {
  assert.throws(() => stagingOrigin("http://127.0.0.1:3101"));
  assert.equal(stagingOrigin("http://127.0.0.1:3101", { allowLoopback: true }).port, "3101");
  assert.throws(() => confirmedStaging({ ...env, STAGING_BASE_URL: "http://127.0.0.1:3101" }));
});

test("staging robots check refuses a production robots policy and follows no redirects", async () => {
  const expected = new URL("/robots.txt", env.STAGING_BASE_URL);
  await verifyStagingRobots(confirmedStaging(env), (url, init) => {
    assert.equal(url.href, expected.href);
    assert.equal(init.redirect, "error");
    return new Response("User-Agent: *\nDisallow: /\n");
  });
  await assert.rejects(verifyStagingRobots(confirmedStaging(env), () => new Response("Allow: /\nDisallow: /admin")));
});

test("Vercel bypass is restricted to the confirmed HTTPS origin and does not follow redirects", async () => {
  const base = confirmedStaging(env);
  const probe = stagingFetch(base, "synthetic-bypass", (target, request) => {
    assert.equal(target.href, `${base.origin}/api/cron/recruitment`);
    assert.equal(request.headers.get("x-vercel-protection-bypass"), "synthetic-bypass");
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-scheduler");
    assert.equal(request.redirect, "manual");
    return new Response(null, { status: 307, headers: { location: "https://elsewhere.example.test/" } });
  });
  const response = await probe("/api/cron/recruitment", { headers: { authorization: "Bearer synthetic-scheduler" } });
  assert.equal(response.status, 307);
  assert.throws(() => probe("https://elsewhere.example.test/"), /left the configured origin/);
  assert.throws(() => stagingFetch(new URL("http://127.0.0.1:3101"), "synthetic-bypass"), /HTTPS/);
});

test("browser uses the preview bypass only to establish a scoped cookie", async () => {
  const calls = [];
  const context = { request: { get: (url, options) => {
    calls.push([url, options]);
    return { status: () => calls.length === 1 ? 307 : 200 };
  } } };
  await openProtectedBrowser(context, confirmedStaging(env), "synthetic-bypass");
  assert.deepEqual(calls.map(([url]) => url), ["https://stage.example.test/robots.txt", "https://stage.example.test/robots.txt"]);
  assert.equal(calls[0][1].headers["x-vercel-protection-bypass"], "synthetic-bypass");
  assert.equal(calls[0][1].headers["x-vercel-set-bypass-cookie"], "true");
  assert.equal(calls[0][1].maxRedirects, 0);
  assert.equal(calls[1][1].headers, undefined);
});

test("migration plan is ordered, fingerprinted, and verifies the selected staging ref", async () => {
  const migrations = await migrationPlan(new URL("../../supabase/migrations/", import.meta.url));
  const files = migrations.map(row => row.file);
  assert.deepEqual(files, [...new Set(files)].sort());
  assert.ok(migrations.every(row => /^[a-f0-9]{64}$/.test(row.sha256)));
  const ref = "abcdefghijklmnopqrst";
  const target = { ...env, STAGING_SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co` };
  assert.equal(verifyLinkedStagingDatabase(target, `${ref}\n`), ref);
  assert.throws(() => verifyLinkedStagingDatabase(target, "different-target"), /CLI link differs/);
  assert.throws(() => verifyLinkedStagingDatabase({ ...target, NEXT_PUBLIC_SUPABASE_URL: "https://another.supabase.co" }, ref), /API URL differs/);
  assert.throws(() => verifyLinkedStagingDatabase({ ...target, SUPABASE_PROJECT_ID: "override" }, ref), /different project/);
});

function evidence(phase) {
  const published = phase === "approved";
  return {
    proposal: {
      company_id: fixture.company, role_id: fixture.role, drive_id: fixture.drive,
      status: phase === "pending" ? "pending" : "approved", observed_excerpt: fixture.quote,
    },
    fields: [{ target_kind: "round", target_id: fixture.round, field_key: "duration_minutes",
      old_value: fixture.before, new_value: fixture.after, evidence_quote: fixture.quote }],
    publicRound: { duration_minutes: published ? fixture.after : fixture.before },
    publicUpdate: published ? { is_current: true } : null,
    history: phase === "pending" ? null : { is_current: published },
    audit: phase === "pending" ? [] : ["recruitment.approve_structured", ...(published ? [] : ["recruitment.rollback"])],
  };
}

for (const phase of ["pending", "approved", "rolled-back"]) {
  test(`recruitment acceptance checks ${phase} evidence`, () => {
    assert.ok(recruitmentPhaseChecks(phase, evidence(phase)).every(([, pass]) => pass));
  });
}

test("recruitment acceptance detects early visibility, unrelated scope and missing evidence", () => {
  const data = evidence("pending");
  data.publicUpdate = { is_current: true };
  data.proposal.company_id = "other-company";
  data.proposal.observed_excerpt = "Different source text.";
  assert.equal(recruitmentPhaseChecks("pending", data).filter(([, pass]) => !pass).length, 3);
});
