// Local, real-PostgreSQL checks of isolation and lock ordering across transactions.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
const connectionString=process.env.ACCESS_TEST_DATABASE_URL??'postgresql://postgres@127.0.0.1:5432/placementways_test';
const url=new URL(connectionString);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/placementways_test')throw new Error('Disposable local database required');
const pool=new pg.Pool({connectionString,max:6});
const users=Array.from({length:4},()=>randomUUID());const tokens=Array.from({length:2},()=>randomBytes(32).toString('hex'));const nets=Array.from({length:2},()=>randomBytes(32).toString('hex'));
const a=await pool.connect(),b=await pool.connect();
async function begin(db,user){await db.query('begin');await db.query("set local lock_timeout='1500ms'");await db.query("set local statement_timeout='5000ms'");await db.query(`set local role ${user?'authenticated':'service_role'}`);if(user)await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,role:'authenticated'})]);}
async function start(db,test){return db.query('select public.start_test_attempt($1)',[test]);}
async function waitingOnAdvisory(db){const pid=(await pool.query('select pid,wait_event from pg_stat_activity where pid=$1',[db.processID])).rows[0];return pid?.wait_event==='advisory';}
async function waitForLock(db){for(let i=0;i<100;i++){if(await waitingOnAdvisory(db))return;await new Promise(r=>setTimeout(r,10));}throw new Error('Expected advisory lock wait');}
try{
 for(const id of users)await pool.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@scoped-lock.test`]);
 const tests=(await pool.query("select id from mock_tests where status='published' and guest_attempt_allowed order by id limit 2")).rows.map(r=>r.id);assert.equal(tests.length,2);
 const q=(await pool.query('select question_id from test_questions where test_id=$1 order by question_order limit 1',[tests[0]])).rows[0].question_id;
 await begin(a,users[0]);await start(a,tests[0]);
 await begin(b,users[1]);await start(b,tests[1]);await b.query('commit');await a.query('commit');
 console.log('Unrelated authenticated mock starts proceed independently');
 await begin(a,null);await a.query("select guest_mock_gateway('start',$1,$2,p_network_hash=>$3)",[tokens[0],tests[0],nets[0]]);
 await begin(b,null);await b.query("select guest_mock_gateway('start',$1,$2,p_network_hash=>$3)",[tokens[1],tests[1],nets[1]]);await b.query('commit');await a.query('commit');
 console.log('Unrelated guest tokens/networks proceed independently');
 await begin(a,users[2]);await start(a,tests[0]);
 await begin(b,users[2]);const practice=b.query('select submit_practice($1,$2)',[q,'A']).then(()=>({code:null}),e=>({code:e.code}));
 await waitForLock(b);
 // Practice must wait on the user key BEFORE taking the profile row.
 await a.query('select id from profiles where id=$1 for update',[users[2]]);await a.query('commit');
 assert.equal((await practice).code,'23514');await b.query('rollback');
 console.log('Practice/start ordering avoids profile inversion and hides active answers');
 // A definition edit waits for a concurrent start, then sees committed history.
 await begin(a,users[3]);await start(a,tests[0]);await begin(b,null);
 const edit=b.query("update questions set question_text=question_text||' modified' where id=$1",[q]).then(()=>({code:null}),e=>({code:e.code}));
 await waitForLock(b);await a.query('commit');assert.equal((await edit).code,'23514');await b.query('rollback');
 console.log('Concurrent question editing cannot mutate an issued mock');
}finally{
 await a.query('rollback');await b.query('rollback');a.release();b.release();
 await pool.query('delete from test_attempts where user_id=any($1::uuid[]) or guest_id in(select id from guest_mock_sessions where token_hash=any($2::text[]))',[users,tokens]);
 await pool.query('delete from guest_mock_sessions where token_hash=any($1::text[])',[tokens]);await pool.query('delete from guest_mock_rate_limits where network_hash=any($1::text[])',[nets]);await pool.query('delete from auth.users where id=any($1::uuid[])',[users]);await pool.end();
}
