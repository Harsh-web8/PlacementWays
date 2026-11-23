/** Small read-only staging acceptance probe. No credentials and no database writes. */
export const SMOKE_CASES = Object.freeze([
  {name:'Homepage',method:'GET',path:'/',expected:200},
  {name:'Company directory',method:'GET',path:'/companies',expected:200},
  {name:'Recruitment feed',method:'GET',path:'/recruitment',expected:200},
  {name:'No-login SQL lab',method:'GET',path:'/sql',expected:200},
  {name:'Free mock-test catalog',method:'GET',path:'/tests',expected:200},
  {name:'Free practice catalog',method:'GET',path:'/practice',expected:200},
  {name:'Free coding catalog',method:'GET',path:'/coding',expected:200},
  {name:'Privacy policy',method:'GET',path:'/privacy-policy',expected:200},
  {name:'Database health',method:'GET',path:'/api/health',expected:200},
  {name:'Student registration disabled',method:'GET',path:'/register',expected:'registration-redirect'},
  {name:'Admin requires authentication',method:'GET',path:'/admin',expected:'protected'},
  {name:'Recruitment scheduler rejects anonymous calls',method:'POST',path:'/api/cron/recruitment',expected:401},
]);

export function evaluateSmokeResponse(item,response,body='',origin='https://staging.example') {
  const status=response.status;
  const localRedirect=(location,path)=>{
    if(!location)return false;
    try {const destination=new URL(location,origin);return destination.origin===new URL(origin).origin && destination.pathname===path;}
    catch{return false;}
  };
  if(item.expected==='registration-redirect'){
    const location=response.headers.get('location')??'';
    return {pass:[301,302,303,307,308].includes(status) && localRedirect(location,'/companies'),note:`HTTP ${status} · redirects to public companies`};
  }
  if(item.expected==='protected'){
    const location=response.headers.get('location')??'';
    const protectedResponse=[401,403].includes(status) || ([301,302,303,307,308].includes(status) && localRedirect(location,'/login'));
    return {pass:protectedResponse,note:`HTTP ${status} · private admin route`};
  }
  if(item.path==='/api/health'){
    let valid=false;
    try{valid=JSON.parse(body).status==='ok';}catch{}
    return {pass:status===200&&valid,note:`HTTP ${status} · ${valid?'database available':'database not ready'}`};
  }
  return {pass:status===item.expected,note:`HTTP ${status}`};
}

export async function runStagingSmoke(baseUrl,{fetchImpl=fetch,timeoutMs=12000}={}) {
  const results=[];
  for(const item of SMOKE_CASES){
    try {
      const response=await fetchImpl(new URL(item.path,baseUrl),{
        method:item.method,redirect:'manual',signal:AbortSignal.timeout(timeoutMs),
        headers:{'User-Agent':'PlacementWays-Staging-Readiness/1.0','Accept':'text/html,application/json'},
      });
      const body=item.path==='/api/health'?await response.text():'';
      const evaluated=evaluateSmokeResponse(item,response,body,baseUrl.toString());
      results.push({name:item.name,pass:evaluated.pass,note:evaluated.note});
    } catch(error){results.push({name:item.name,pass:false,note:error instanceof Error?error.name:'Unknown request failure'});}
  }
  return results;
}
