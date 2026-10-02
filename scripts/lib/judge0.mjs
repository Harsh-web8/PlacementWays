// Judge0 CE REST contract: https://ce.judge0.com/ . Run only in the private worker.
// Provider tokens, hidden inputs and outputs must never be sent to the browser.
const encode = value => Buffer.from(value, "utf8").toString("base64");
const decode = value => typeof value === "string" ? Buffer.from(value,"base64").toString("utf8").slice(0,4000) : "";
export function submissionPayload(source, languageId, testcase) {
  return {source_code:encode(source),language_id:languageId,stdin:encode(testcase.input),expected_output:encode(testcase.expected_output),
    cpu_time_limit:2,cpu_extra_time:0.5,wall_time_limit:5,memory_limit:128000,stack_limit:64000,
    max_processes_and_or_threads:60,max_file_size:64,enable_network:false,number_of_runs:1};
}
export async function boundedJson(response) {
  if(!response.ok)throw new Error(`Provider HTTP ${response.status}`);
  const reader=response.body?.getReader();if(!reader)throw new Error("Empty provider response");
  const chunks=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000)throw new Error("Provider response too large");chunks.push(value);}}
  finally {await reader.cancel();}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function verdict(results,cases) {
  if(results.length!==cases.length)throw new Error("Incomplete results");
  let passed=0;let status="accepted";
  const feedback=results.map((r,i)=>{
    const id=r.status?.id;
    if(!Number.isInteger(id)||id<=2||id>14)throw new Error("Unfinished or invalid verdict");
    if(id===3)passed++;
    else if(status==="accepted")status=id===4?"wrong_answer":id===5?"time_limit":id===6?"compile_error":id>=13?"error":"runtime_error";
    // A hidden test can print its stdin; never expose ANY hidden execution output.
    return {case:i+1,sample:cases[i].sample,status:id===3?"passed":id===4?"wrong_answer":id===5?"time_limit":id===6?"compile_error":id>=13?"error":"runtime_error",
      ...(cases[i].sample?{stdout:decode(r.stdout),stderr:decode(r.stderr),compile_output:decode(r.compile_output)}:{})};
  });
  if(results.some(r=>r.status?.id>=13))status="error";
  return {status,passed,feedback};
}
export function judgeClient(env=process.env) {
  const url=new URL(env.JUDGE0_URL??"");
  if(url.protocol!=="https:" && !(env.ALLOW_LOCAL_SERVICES==="true" && ["localhost","127.0.0.1"].includes(url.hostname)))throw new Error("Judge0 requires HTTPS");
  if(url.username||url.password||url.search||url.hash)throw new Error("Invalid Judge0 URL");
  const base=url.href.replace(/\/$/,"");
  const headers={"content-type":"application/json",...(env.JUDGE0_AUTH_TOKEN?{"X-Auth-Token":env.JUDGE0_AUTH_TOKEN}:{}),...(env.JUDGE0_RAPIDAPI_KEY?{"X-RapidAPI-Key":env.JUDGE0_RAPIDAPI_KEY,"X-RapidAPI-Host":url.hostname}:{})};
  const request=(path,init={})=>fetch(base+path,{...init,headers,redirect:"error",signal:AbortSignal.timeout(15000)}).then(boundedJson);
  return {
    async create(payload){
      const tokens=await request("/submissions/batch?base64_encoded=true",{method:"POST",body:JSON.stringify({submissions:payload.cases.map(c=>submissionPayload(payload.source,payload.language_id,c))})});
      if(!Array.isArray(tokens)||tokens.length!==payload.cases.length||tokens.some(t=>typeof t.token!=="string"||!/^[a-f0-9-]{36}$/i.test(t.token)))throw new Error("Invalid provider tokens");
      return tokens.map(t=>t.token);
    },
    async results(tokens){
      if(!Array.isArray(tokens)||tokens.some(t=>typeof t!=="string"||!/^[a-f0-9-]{36}$/i.test(t)))throw new Error("Invalid tokens");
      const data=await request(`/submissions/batch?tokens=${encodeURIComponent(tokens.join(","))}&base64_encoded=true&fields=status,stdout,stderr,compile_output`);
      if(!Array.isArray(data.submissions)||data.submissions.length!==tokens.length)throw new Error("Invalid provider result");
      return data.submissions;
    }
  };
}
