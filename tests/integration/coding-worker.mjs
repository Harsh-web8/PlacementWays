// Explicit opt-in: exercises the real worker with synthetic programs only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
if(process.env.RUN_LIVE_JUDGE_TEST!=='true'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:54400')throw new Error('Requires local access fixture and explicit live-provider opt-in');
const pool=new pg.Pool({connectionString:'postgresql://postgres@127.0.0.1:5432/placementways_test'});
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const login=await db.auth.signInWithPassword({email:'student@example.com',password:'Password1'});assert.equal(login.error,null);
const question=(await pool.query("select id from questions where slug='maximum-array-scan'")).rows[0].id;
const previous=(await pool.query('select coding_enabled from site_settings')).rows[0].coding_enabled;
await pool.query('update site_settings set coding_enabled=true');
const worker=spawn(process.execPath,['scripts/coding-worker.mjs'],{env:process.env,stdio:['ignore','inherit','inherit']});
try{
 let ready=false;for(let i=0;i<20;i++){const r=await pool.query("select 1 from worker_heartbeats where name='coding' and last_seen>now()-interval '10 seconds'");if(r.rowCount){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'worker heartbeat');
 for(const [source,expected,language="python"] of [['import sys\na=list(map(int,sys.stdin.read().split()))\nprint(max(a[1:]))','accepted'],['print(999)','wrong_answer'],['if ???','runtime_error'],['int main( ???','compile_error','cpp'],['while True: pass','time_limit']]){
  if(process.env.CHECK_VERDICT && expected!==process.env.CHECK_VERDICT)continue;
  const started=await db.rpc('start_coding_submission',{p_question_id:question,p_language:language,p_source:source,p_kind:'submit'});assert.equal(started.error,null,started.error?.message);
  let result;for(let i=0;i<100;i++){const read=await db.from('coding_submissions').select('*').eq('id',started.data).single();assert.equal(read.error,null);result=read.data;if(!['queued','running'].includes(result.status))break;await new Promise(r=>setTimeout(r,1000));}
  assert.equal(result.status,expected);assert.ok(result.practice_attempt_id,'submitted verdict saves progress');
  for(const feedback of result.feedback.filter(f=>!f.sample))for(const field of ['stdout','stderr','compile_output','input','expected_output'])assert.equal(feedback[field],undefined,'hidden test detail must remain private');
  console.log(`Worker integration passed: ${expected}`);
 }
}finally{worker.kill('SIGTERM');await once(worker,'exit');await pool.query('update site_settings set coding_enabled=$1',[previous]);await pool.end();await db.auth.signOut();}
