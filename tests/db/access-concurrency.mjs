// Run only after the SQL suite has built the disposable local database.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
const connectionString=process.env.ACCESS_TEST_DATABASE_URL??"postgresql://postgres@127.0.0.1:5432/placementways_test";
const target=new URL(connectionString);
if(!["127.0.0.1","localhost"].includes(target.hostname)||target.pathname!=="/placementways_test")throw new Error("Local disposable test database required");
const pool=new pg.Pool({connectionString,max:12});
const tokens=[],networks=[];
const token=()=>{const v=randomBytes(32).toString("hex");tokens.push(v);return v;};
const network=()=>{const v=randomBytes(32).toString("hex");networks.push(v);return v;};
async function start(hash,test,net){
  const db=await pool.connect();
  try{
    await db.query("begin");await db.query("set local role service_role");
    const {rows}=await db.query("select public.guest_mock_gateway('start',$1,$2,p_network_hash=>$3) as result",[hash,test,net]);
    await db.query("commit");return rows[0].result;
  }catch(e){await db.query("rollback");throw e;}finally{db.release();}
}
try {
 const {rows:tests}=await pool.query("select id from public.mock_tests where status='published' and guest_attempt_allowed order by id limit 2");
 assert.equal(tests.length,2);
 const same=token(),net=network();
 const resumes=await Promise.all(Array.from({length:8},()=>start(same,tests[0].id,net)));
 assert.ok(resumes.every(r=>r.decision==="allow"));
 assert.equal(new Set(resumes.map(r=>r.attempt_id)).size,1,"concurrent same-test starts resume one attempt");
 const cross=token(),crossNet=network();
 const starts=await Promise.all(tests.map(t=>start(cross,t.id,crossNet)));
 assert.deepEqual(starts.map(r=>r.decision).sort(),["allow","login"],"cross-test starts cannot race global guest allowance");
 const shared=network();
 const {rows:[settings]}=await pool.query("select guest_network_daily_limit from public.site_settings where id=true");
 assert.equal(settings.guest_network_daily_limit,5,"run against default test seed settings");
 const resets=await Promise.all(Array.from({length:6},()=>start(token(),tests[0].id,shared)));
 assert.equal(resets.filter(r=>r.decision==="allow").length,5);
 assert.equal(resets.filter(r=>r.decision==="rate_limited").length,1);
 console.log("Concurrent resume, cross-mock quota, and cookie-reset network limits passed.");
} finally {
 await pool.query("delete from public.test_attempts where guest_id in (select id from public.guest_mock_sessions where token_hash=any($1::text[]))",[tokens]);
 await pool.query("delete from public.guest_mock_sessions where token_hash=any($1::text[])",[tokens]);
 await pool.query("delete from public.guest_mock_rate_limits where network_hash=any($1::text[])",[networks]);
 await pool.end();
}
