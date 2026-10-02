// Explicit opt-in: sends only these synthetic programs to the configured isolated provider.
import assert from "node:assert/strict";
import { judgeClient,verdict } from "../../scripts/lib/judge0.mjs";
if(process.env.RUN_LIVE_JUDGE_TEST!=="true")throw new Error("Set RUN_LIVE_JUDGE_TEST=true to run provider smoke tests");
const client=judgeClient();const cases=[{input:"",expected_output:"42\n",sample:true}];
const samples=[
 {name:"Python",language_id:71,source:"print(6*7)"},
 {name:"JavaScript",language_id:93,source:"console.log(6*7)"},
 {name:"C++",language_id:54,source:'#include <iostream>\nint main(){std::cout << 6*7 << "\\n";}'},
 {name:"Java",language_id:91,source:'public class Main { public static void main(String[] args) { System.out.println(6*7); } }'},
];
for(const sample of samples){
 const tokens=await client.create({...sample,cases});let done=false;
 for(let i=0;i<20;i++){
  const results=await client.results(tokens);
  if(results.every(r=>r.status?.id>2)){const result=verdict(results,cases);assert.equal(result.status,"accepted",`${sample.name}: ${JSON.stringify(result.feedback)}`);done=true;break;}
  await new Promise(r=>setTimeout(r,1000));
 }
 assert.ok(done,`${sample.name} timed out`);console.log(`${sample.name}: compilation/execution accepted`);
}
