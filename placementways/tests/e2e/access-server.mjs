// Local integration fixture: synthetic Auth plus REAL PostgreSQL access RPCs/RLS.
// Run test:db first. Never point at hosted/shared databases.
import pg from "pg";
import { startMock, users } from "./mock-supabase.mjs";
const connectionString = process.env.ACCESS_TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/placementways_test";
const target = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/placementways_test") throw new Error("Use the disposable local test database only.");
const key = process.env.ACCESS_TEST_SERVICE_KEY;
if (!key) throw new Error("Set a synthetic ACCESS_TEST_SERVICE_KEY.");
const pool = new pg.Pool({ connectionString });
for (const user of Object.values(users)) {
  await pool.query("insert into auth.users(id,email) values($1,$2) on conflict(id) do nothing", [user.id,user.email]);
  await pool.query("update public.profiles set role=$2,is_active=$3 where id=$1",[user.id,user.profile.role,user.profile.is_active]);
}
const rpcArgs = {
  get_practice_question:["p_slug"],
  can_read_lesson:["p_lesson_id"],
  start_coding_submission:["p_question_id","p_language","p_source","p_kind"],
  claim_coding_job:[],save_coding_tokens:["p_id","p_lease","p_tokens"],finish_coding_job:["p_id","p_lease","p_status","p_passed","p_feedback"],
  create_purchase_order:["p_kind","p_content_id"],attach_checkout_session:["p_order_id","p_session_id"],
  apply_payment_event:["p_event_id","p_action","p_session_id","p_payment_intent","p_amount","p_currency"],request_order_refund:["p_order_id"],

  guest_mock_gateway:["p_operation","p_token_hash","p_test_id","p_attempt_id","p_network_hash","p_question_id","p_selected","p_marked","p_answers"],
  claim_guest_mock:["p_token_hash","p_attempt_id","p_user_id"],
  mock_access_decision:["p_test_id"],
  has_content_access:["p_test_id","p_course_id"],
  start_test_attempt:["p_test_id"],
  get_attempt_state:["p_attempt_id"],get_attempt_result:["p_attempt_id"],
  save_attempt_answer:["p_attempt_id","p_question_id","p_selected","p_marked"],submit_attempt:["p_attempt_id","p_answers"],
};
const tables = new Set(["mock_tests","published_mock_tests","mock_test_categories","companies","categories","test_attempts","site_settings","content_entitlements","coding_languages","coding_submissions","coding_examples","coding_test_cases","worker_heartbeats","purchase_orders","payment_events","questions","audit_logs","blog_posts","courses","practice_questions","lesson_contents"]);
const columns = new Set(["id","slug","status","test_id","user_id","company_id","guest_id","category_id","question_id","key","enabled","lesson_id","action"]);
const writable = {
 site_settings: new Set(["coding_enabled","coding_hourly_limit","coding_daily_limit","support_email","announcement","commerce_enabled","guest_mock_enabled","guest_mock_limit","guest_network_daily_limit"]),
 coding_languages: new Set(["name","provider_id","enabled"]),
 coding_test_cases: new Set(["question_id","input","expected_output","is_sample","position"]),
 audit_logs: new Set(["actor_id","action","entity_type","entity_id","metadata"]),
};
const server = await startMock(Number(process.env.ACCESS_TEST_PORT ?? 54400), async ({req,url,user,body,json}) => {
  const name = url.pathname.split("/").pop();
  if (!tables.has(name) && !(url.pathname.includes("/rpc/") && rpcArgs[name])) return false;
  const db=await pool.connect();
  try {
    await db.query("begin");
    const service = req.headers.authorization === `Bearer ${key}`;
    await db.query(`set local role ${service ? "service_role" : user ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(user ? {sub:user.id,role:"authenticated"} : {})]);
    let rows;
    if (url.pathname.includes("/rpc/")) {
      const params = rpcArgs[name].filter(k=>Object.hasOwn(body,k));
      const values = params.map(k=>["p_answers","p_tokens","p_feedback"].includes(k) ? JSON.stringify(body[k]) : body[k]);
      rows=(await db.query(`select public.${name}(${params.map((k,i)=>`${k}=>$${i+1}`).join(",")}) as result`,values)).rows;
      await db.query("commit");json(200,rows[0].result);return true;
    }

    const values=[];const filters=[];
    for(const [col,filter] of url.searchParams) {
      if(!columns.has(col))continue;
      if(filter==="is.null"){filters.push(`${col} is null`);continue;}
      if(filter==="not.is.null"){filters.push(`${col} is not null`);continue;}
      if(filter.startsWith("eq.")){values.push(filter.slice(3));filters.push(`${col}=$${values.length}`);}
      if(filter.startsWith("in.(")){values.push(filter.slice(4,-1).split(","));filters.push(`${col}::text=any($${values.length}::text[])`);}
    }
    const where=filters.length ? " where "+filters.join(" and ") : "";
    if(req.method==="GET"||req.method==="HEAD"){
      const order=(url.searchParams.get("order")??"").split(",").filter(Boolean).map(term=>{
        const [col,direction]=term.split(".");
        if(!["id","created_at","updated_at","position","key","name","sort_order","title"].includes(col)||!["asc","desc"].includes(direction))throw new Error("Unsupported fixture order");
        return `${col} ${direction}`;
      });
      rows=(await db.query(`select * from public.${name}${where}${order.length?" order by "+order.join(","):""} limit 500`,values)).rows;
    }
    else if(writable[name] && ["PATCH","POST","DELETE"].includes(req.method)){
      const entries=Object.entries(body);
      if(entries.some(([col])=>!writable[name].has(col)))throw new Error("Unsupported fixture column");
      if(req.method!=="POST"&&!filters.length)throw new Error("Fixture writes require a filter");
      if(req.method==="DELETE")rows=(await db.query(`delete from public.${name}${where} returning *`,values)).rows;
      else{
        const slots=entries.map(([,value])=>{values.push(typeof value==="object"?JSON.stringify(value):value);return `$${values.length}`;});
        const sql=req.method==="POST"?`insert into public.${name}(${entries.map(([col])=>col).join(",")}) values(${slots.join(",")}) returning *`:`update public.${name} set ${entries.map(([col],i)=>`${col}=${slots[i]}`).join(",")}${where} returning *`;
        rows=(await db.query(sql,values)).rows;
      }
    }else{await db.query("rollback");json(405,{});return true;}
    await db.query("commit");
    json(200,req.headers.accept?.includes("application/vnd.pgrst.object+json") ? rows[0]??null : rows,{"content-range":`0-${Math.max(0,rows.length-1)}/${rows.length}`});
  } catch(error) {await db.query("rollback");json(400,{code:error.code??"fixture_error",message:error.message});}
  finally {db.release();}
  return true;
});
console.log("Access integration fixture ready (synthetic Auth, real PostgreSQL).");
async function stop(){server.close();await pool.end();}
process.on("SIGTERM",stop);process.on("SIGINT",stop);
