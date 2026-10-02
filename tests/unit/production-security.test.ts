import { describe,it,expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyStripeSignature,readBoundedBody } from "@/lib/billing/webhook";
import { submissionPayload,verdict } from "../../scripts/lib/judge0.mjs";
const secret="synthetic-webhook-secret";const now=Date.parse("2026-09-29T00:00:00Z");const timestamp=String(now/1000);
function signature(body:string){return `t=${timestamp},v1=${createHmac("sha256",secret).update(`${timestamp}.${body}`).digest("hex")}`;}
describe("payment webhook boundary",()=>{
 it("accepts only signed raw bytes within five minutes",()=>{
  const body='{"id":"evt_fixture"}';expect(verifyStripeSignature(body,signature(body),secret,now)).toBe(true);
  expect(verifyStripeSignature(body+" ",signature(body),secret,now)).toBe(false);
  expect(verifyStripeSignature(body,signature(body),secret,now+301000)).toBe(false);
  expect(verifyStripeSignature(body,signature(body),"different",now)).toBe(false);
 });
 it("supports rotated signatures and rejects malformed signatures",()=>{
  expect(verifyStripeSignature("x",signature("x")+",v1="+"0".repeat(64),secret,now)).toBe(true);
  expect(verifyStripeSignature("x",`t=${timestamp},v1=short`,secret,now)).toBe(false);
  expect(verifyStripeSignature("x",null,secret,now)).toBe(false);
 });
 it("bounds request bodies even without Content-Length",async()=>{
  await expect(readBoundedBody(new Request("https://local.test",{method:"POST",body:"x".repeat(100)}),10)).rejects.toThrow("too large");
 });
});
describe("isolated execution boundary",()=>{
 it("forces resource limits and disables networking",()=>{
  expect(submissionPayload("print(1)",71,{input:"secret",expected_output:"1"})).toMatchObject({enable_network:false,cpu_time_limit:2,wall_time_limit:5,memory_limit:128000,max_file_size:64});
 });
 it("never exposes hidden output, stderr or compile logs",()=>{
  const result=verdict([{status:{id:4},stdout:Buffer.from("hidden input").toString("base64"),stderr:Buffer.from("secret").toString("base64"),compile_output:Buffer.from("secret").toString("base64")}],[{sample:false}]);
  expect(result).toEqual({status:"wrong_answer",passed:0,feedback:[{case:1,sample:false,status:"wrong_answer"}]});
 });
 it("distinguishes execution errors and infrastructure errors",()=>{
  expect(verdict([{status:{id:5}}],[{sample:true}]).status).toBe("time_limit");
  expect(verdict([{status:{id:6}}],[{sample:true}]).status).toBe("compile_error");
  expect(verdict([{status:{id:13}}],[{sample:true}]).status).toBe("error");
  expect(()=>verdict([{status:{id:2}}],[{sample:true}])).toThrow();
 });
});
