import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SMOKE_CASES,evaluateSmokeResponse,runStagingSmoke} from '../../scripts/lib/staging-smoke-core.mjs';
const response=(status,headers={},body='')=>({status,headers:new Headers(headers),text:async()=>body});
test('all required public routes and admin boundaries are enumerated',()=>{
 assert.equal(SMOKE_CASES.length,12);
 assert.ok(SMOKE_CASES.some(x=>x.path==='/api/cron/recruitment'&&x.method==='POST'));
});
test('registration must redirect to public pages',()=>{
 const item=SMOKE_CASES.find(x=>x.path==='/register');
 assert.equal(evaluateSmokeResponse(item,response(307,{location:'/companies'})).pass,true);
 assert.equal(evaluateSmokeResponse(item,response(307,{location:'https://staging.example/companies'})).pass,true);
 assert.equal(evaluateSmokeResponse(item,response(200)).pass,false);
 assert.equal(evaluateSmokeResponse(item,response(307,{location:'https://attacker.example'})).pass,false);
});
test('admin must redirect to local login or deny access',()=>{
 const item=SMOKE_CASES.find(x=>x.path==='/admin');
 assert.equal(evaluateSmokeResponse(item,response(307,{location:'/login?next=%2Fadmin'})).pass,true);
 assert.equal(evaluateSmokeResponse(item,response(403)).pass,true);
 assert.equal(evaluateSmokeResponse(item,response(307,{location:'https://staging.example/login?next=%2Fadmin'})).pass,true);
 assert.equal(evaluateSmokeResponse(item,response(200)).pass,false);
});
test('health endpoint must report an actual ok JSON body',()=>{
 const item=SMOKE_CASES.find(x=>x.path==='/api/health');
 assert.equal(evaluateSmokeResponse(item,response(200),'{"status":"ok"}').pass,true);
 assert.equal(evaluateSmokeResponse(item,response(200),'{"status":"unavailable"}').pass,false);
});
test('complete simulated staging accepts all checks',async()=>{
 const results=await runStagingSmoke(new URL('https://staging.example'),{
   fetchImpl:async (url,init)=>{
     const path=url.pathname;
     if(path==='/register')return response(307,{location:'/companies'});
     if(path==='/admin')return response(307,{location:'/login?next=%2Fadmin'});
     if(path==='/api/cron/recruitment')return response(init.method==='POST'?401:405);
     if(path==='/api/health')return response(200,{},'{"status":"ok"}');
     return response(200);
   },
 });
 assert.equal(results.length,12);assert.ok(results.every(r=>r.pass));
});
test('a reachable but insecure admin route fails release smoke',async()=>{
 const results=await runStagingSmoke(new URL('https://staging.example'),{
   fetchImpl:async (url)=>url.pathname==='/admin'?response(200):response(503),
 });
 assert.equal(results.find(r=>r.name.includes('Admin')).pass,false);
});
