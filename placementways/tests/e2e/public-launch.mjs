/**
 * V1 public-launch E2E regression: real Next build and HTTP requests against
 * an in-memory Supabase API fixture. This is *not* a live Supabase test.
 * The legacy authenticated-student/commerce test remains separately available
 * for a future opt-in account release.
 */
import {spawn} from 'node:child_process';
import {startMock,users} from './mock-supabase.mjs';
import {attemptPath,codingPath,launchRequestFixture,mockPath,serviceKey,submissionPath} from './public-launch-fixtures.mjs';

const MOCK_PORT=54398, APP_PORT=3101, APP=`http://127.0.0.1:${APP_PORT}`;
const mock=await startMock(MOCK_PORT,launchRequestFixture());
const env={...process.env,
  NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:'a'.repeat(40),
  NEXT_PUBLIC_SITE_URL:APP,
  SUPABASE_SERVICE_ROLE_KEY:serviceKey,
  GUEST_RATE_LIMIT_SECRET:'local-fixture-rate-limit-secret'.repeat(2),
  GUEST_TRUSTED_IP_HEADER:'x-fixture-client-ip',
  PLACEMENTWAYS_ENABLE_COMMERCE:'false',
  DEPLOYMENT_ENV:'staging',
  STRIPE_LIVE_MODE:'false',
};
// Do not block the parent event loop: the Supabase fixture HTTP server must
// remain responsive while Next builds/prerenders the application.
const build=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{
  env,stdio:'inherit',
});
const buildOk=await new Promise(resolve=>{
  let settled=false;
  const settle=(success)=>{if(settled)return;settled=true;clearTimeout(timeout);resolve(success);};
  const timeout=setTimeout(()=>{build.kill('SIGTERM');settle(false);},240000);
  build.on('exit',(code)=>settle(code===0));
  build.on('error',()=>settle(false));
});
if(!buildOk){mock.close();process.exit(1);}
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(APP_PORT)],{
  env,stdio:['ignore','ignore','inherit'],
});
let failures=0;
const check=(passed,message)=>{console.log(`${passed?'PASS':'FAIL'} ${message}`);if(!passed)failures++;};
const get=(path,options={})=>fetch(APP+path,{redirect:'manual',signal:AbortSignal.timeout(10000),...options});
async function submitForm(path,html,label,fields={}){
  const form=html.split('<form').slice(1).map(chunk=>chunk.split('</form>')[0]).find(chunk=>chunk.includes(label));
  if(!form)throw new Error(`Missing form at ${path}`);
  const body=new FormData();
  for(const [input] of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)){
    const name=input.match(/name="([^"]+)"/)?.[1];
    const value=(input.match(/value="([^"]*)"/)?.[1]??'').replace(/&quot;/g,'"')
      .replace(/&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    if(name)body.append(name,value);
  }
  for(const [name,value] of Object.entries(fields))body.set(name,value);
  return get(path,{method:'POST',headers:{origin:APP,'x-fixture-client-ip':'192.0.2.25'},body});
}

const privateResponse=(res)=>/private/i.test(res.headers.get('cache-control')??'')&&
  /no-store/i.test(res.headers.get('cache-control')??'');
try{
  let ready=false;
  for(let i=0;i<60;i++){
    try{if((await get('/')).status===200){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  check(ready,'Next.js app starts with mock Supabase');
  if(ready){
    const home=await get('/');
    const html=await home.text();
    check(home.status===200,'homepage publicly accessible');
    check(html.includes('href="/companies"')&&html.includes('href="/tests"'),
      'main navigation links directly to preparation');
    check(!html.includes('href="/register"'),
      'homepage does not ask students to register');
    for(const path of ['/companies','/recruitment','/tests','/practice','/coding','/sql','/courses','/blog','/api/health']){
      const res=await get(path);
      check(res.status===200,`${path} accessible without a student session`);
    }
    const registration=await get('/register');
    check([301,302,303,307,308].includes(registration.status)&&
      new URL(registration.headers.get('location')||'/',APP).pathname==='/companies',
      'registration disabled and redirected to company browsing');
    const admin=await get('/admin');
    check(admin.status!==200 && [301,302,303,307,308,401,403].includes(admin.status),
      'private admin dashboard denies anonymous access');
    const cron=await get('/api/cron/recruitment',{method:'POST'});
    check(cron.status===401,'recruitment scheduler rejects missing secret');
    check((await get('/companies/does-not-exist')).status===404,
      'unpublished / unknown company is not shown');
    const course=await get('/courses/fixture-foundations');
    check(course.status===200 && (await course.text()).includes('Fixture foundations'),'published course opens without login');
    const role=await get('/companies/fixture-company/roles/fixture-role');
    check(role.status===200 && (await role.text()).includes('Fixture round'),'published role guide renders its assessment rounds');

    const instructions=await get(mockPath);
    const mockStart=await submitForm(mockPath,await instructions.text(),'Start');
    const mockCookie=mockStart.headers.getSetCookie().find(cookie=>cookie.startsWith('__Host-pw-guest='))?.split(';')[0]??'';
    check(mockStart.status===303 && new URL(mockStart.headers.get('location')??'/',APP).pathname===attemptPath && !!mockCookie,
      `published company mock starts with an anonymous browser cookie (HTTP ${mockStart.status})`);
    const runner=await get(attemptPath,{headers:{cookie:mockCookie}});
    const runnerHtml=await runner.text();
    check(runner.status===200 && runnerHtml.includes('Fixture question') && !runnerHtml.includes('Fixture explanation') && privateResponse(runner),
      'owner can open timed mock without early answers or shared caching');
    check((await get(attemptPath)).status===404,'another browser cannot open the mock attempt');

    const workbench=await get(codingPath);
    const codeStart=await submitForm(codingPath,await workbench.text(),'Run examples',{source:'print(42)',language:'python',kind:'run'});
    const codeCookie=codeStart.headers.getSetCookie().find(cookie=>cookie.startsWith('__Host-pw-guest='))?.split(';')[0]??'';
    check(codeStart.status===303 && new URL(codeStart.headers.get('location')??'/',APP).pathname===submissionPath && !!codeCookie,
      `anonymous code submission sets a browser cookie and redirects to its result (HTTP ${codeStart.status})`);
    const owner=await get(submissionPath,{headers:{cookie:codeCookie}});
    check(owner.status===200 && (await owner.text()).includes('print(42)') && privateResponse(owner),
      'guest owner can open a private coding result without login');
    const other=await get(submissionPath,{headers:{cookie:`__Host-pw-guest=${'f'.repeat(64)}`}});
    check(other.status===404 && privateResponse(other),'another guest receives a private 404 for the coding result');
    const api=await get('/api'+submissionPath,{headers:{cookie:codeCookie}});
    check(api.status===200 && (await api.json()).status==='accepted' && privateResponse(api),'owner can poll the coding verdict');
    check((await get('/api'+submissionPath)).status===404,'coding status API denies a browser without the owner cookie');

    if(process.argv.includes('--browser')){
      const {chromium}=await import('playwright-core');
      const {checkGuestFixtures,checkHostedAuth,checkPublicBrowser}=await import('../../scripts/lib/staging-browser.mjs');
      const browser=await chromium.launch({executablePath:process.env.STAGING_BROWSER_EXECUTABLE||undefined});
      try {
        const contextOptions={extraHTTPHeaders:{'x-fixture-client-ip':'192.0.2.25'}};
        await checkPublicBrowser(browser,new URL(APP),contextOptions);
        check(true,'browser verifies mobile, keyboard and offline SQL');
        await checkGuestFixtures(browser,new URL(APP),{
          paths:{mock:mockPath,coding:codingPath,role:'/companies/fixture-company/roles/fixture-role',course:'/courses/fixture-foundations'},
          contextOptions,expectedApiCases:1,lessonLink:'Fixture percentages',
          lessonBody:'Fixture worked example: 20% of 150 is 30.',
        });
        check(true,'browser verifies course and complete guest mock and coding scenarios');
        await checkHostedAuth(browser,new URL(APP),users['admin@example.com'],true);
        await checkHostedAuth(browser,new URL(APP),users['student@example.com'],false);
        check(true,'browser verifies admin sign-in and non-admin denial');
      } finally {
        await browser.close();
      }
    }
  }
}finally{
  app.kill('SIGTERM');
  mock.close();
}
console.log(`Public-launch E2E checks: ${failures?'FAILED':'PASSED'}`);
if(failures)process.exitCode=1;
