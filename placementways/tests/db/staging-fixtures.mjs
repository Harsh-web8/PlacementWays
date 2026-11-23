import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { RECRUITMENT_FIXTURE as fixture, recruitmentPhaseChecks } from "../../scripts/lib/staging-recruitment.mjs";

const connectionString = process.env.ACCESS_TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/placementways_test";
const target = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/placementways_test") {
  throw new Error("Use the disposable local test database only.");
}
const db = new pg.Client({ connectionString });
await db.connect();
const one = async (sql, args) => (await db.query(sql, args)).rows[0] ?? null;
try {
  const seed = await readFile(new URL("../../supabase/fixtures/staging_acceptance.sql", import.meta.url), "utf8");
  await db.query(seed);
  await db.query(seed);
  await db.query("begin");
  await db.query("set local role anon");
  assert.ok(await one("select 1 from published_mock_tests where slug='pw-staging-acceptance-mock'"));
  assert.ok(await one("select 1 from courses where slug='pw-staging-acceptance-course'"));
  assert.ok(await one("select 1 from coding_examples where question_id='dd100000-0000-4000-8000-000000000007'"));
  await db.query("reset role");
  const actor = await one("insert into auth.users(email) values('staging-fixture-admin@example.test') returning id");
  await db.query("update profiles set role='admin' where id=$1", [actor.id]);
  const source = await one("insert into recruitment_watch_sources(company_id,role_id,drive_id,label,source_url) values($1,$2,$3,'Synthetic notice','https://fixture.example.test/notice') returning id",
    [fixture.company, fixture.role, fixture.drive]);
  await db.query("set local role service_role");
  await db.query("select queue_recruitment_scan($1,$2,$3,$4,$5,$6,'[]',true)", [
    source.id, "b".repeat(64), fixture.quote, "Synthetic acceptance round lasts 20 minutes.",
    JSON.stringify({ headline: "Synthetic staging notice", summary: fixture.quote, evidence: fixture.quote, classification: "exam_pattern" }),
    JSON.stringify([{ target_kind: "round", target_id: fixture.round, field_key: "duration_minutes",
      old_value: fixture.before, new_value: fixture.after, evidence_quote: fixture.quote }]),
  ]);
  await db.query("reset role");
  const { id } = await one("select id from recruitment_change_proposals where watch_source_id=$1", [source.id]);
  const evidence = async (phase) => {
    await db.query("set local role anon");
    const publicRound = await one("select duration_minutes from recruitment_rounds where id=$1", [fixture.round]);
    const publicUpdate = await one("select is_current from recruitment_updates where proposal_id=$1", [id]);
    await db.query("reset role");
    const proposal = await one("select * from recruitment_change_proposals where id=$1", [id]);
    const fields = (await db.query("select * from recruitment_field_changes where proposal_id=$1", [id])).rows;
    const history = await one("select is_current from recruitment_updates where proposal_id=$1", [id]);
    const audit = (await db.query("select action from audit_logs where entity_id=$1", [id])).rows.map(row => row.action);
    const checks = recruitmentPhaseChecks(phase, { proposal, fields, publicRound, publicUpdate, history, audit });
    assert.deepEqual(checks.filter(([, pass]) => !pass), []);
  };
  await evidence("pending");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor.id]);
  await db.query("select approve_recruitment_proposal($1,true)", [id]);
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub','',true)");
  await evidence("approved");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor.id]);
  await db.query("select rollback_recruitment_proposal($1)", [id]);
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub','',true)");
  await evidence("rolled-back");
  console.log("Staging fixture seed, public RLS, and pending, approved and rolled-back evidence passed on local PostgreSQL.");
} finally {
  await db.query("rollback");
  await db.end();
}
