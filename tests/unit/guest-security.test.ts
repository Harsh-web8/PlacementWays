import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixture=vi.hoisted(()=>({cookie:undefined as string|undefined,set:vi.fn(),headers:new Map<string,string>()}));
vi.mock("server-only",()=>({}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>fixture.cookie?{value:fixture.cookie}:undefined,set:fixture.set}),headers:async()=>({get:(key:string)=>fixture.headers.get(key)??null})}));
import { guestHash, networkRateHash } from "@/server/access/guest";
beforeEach(()=>{fixture.cookie=undefined;fixture.set.mockClear();fixture.headers.clear();vi.stubEnv("NODE_ENV","production");vi.stubEnv("GUEST_RATE_LIMIT_SECRET","");vi.stubEnv("GUEST_TRUSTED_IP_HEADER","");});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
describe("guest security boundary",()=>{
 it("does not create identity just to browse",async()=>{
  expect(await guestHash()).toBeNull();expect(fixture.set).not.toHaveBeenCalled();
 });
 it("issues a random HttpOnly host cookie and returns only its hash",async()=>{
  const hash=await guestHash(true);
  const [name,value,options]=fixture.set.mock.calls[0];
  expect(name).toBe("__Host-pw-guest");expect(value).toMatch(/^[a-f0-9]{64}$/);expect(hash).not.toBe(value);
  expect(options).toMatchObject({httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:2592000});
  fixture.cookie=value;expect(await guestHash()).toBe(hash);
 });
 it("ignores a forged client completion flag",async()=>{
  fixture.cookie='hasCompletedFreeMock=false';expect(await guestHash()).toBeNull();
 });
 it("fails closed without trusted ingress configuration",async()=>{
  fixture.headers.set("x-forwarded-for","192.0.2.1");await expect(networkRateHash()).rejects.toThrow("not configured");
 });
 it("rejects multi-address or missing trusted headers",async()=>{
  vi.stubEnv("GUEST_RATE_LIMIT_SECRET","synthetic-test-secret-32-characters-long");vi.stubEnv("GUEST_TRUSTED_IP_HEADER","x-test-ip");
  await expect(networkRateHash()).rejects.toThrow("unavailable");fixture.headers.set("x-test-ip","192.0.2.1, 192.0.2.2");await expect(networkRateHash()).rejects.toThrow("unavailable");
 });
 it("rotates network keys daily without returning the raw address",async()=>{
  vi.stubEnv("GUEST_RATE_LIMIT_SECRET","synthetic-test-secret-32-characters-long");vi.stubEnv("GUEST_TRUSTED_IP_HEADER","x-test-ip");fixture.headers.set("x-test-ip","192.0.2.1");
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-29T10:00:00Z"));const first=await networkRateHash();
  expect(first).toMatch(/^[a-f0-9]{64}$/);expect(first).not.toContain("192.0.2.1");
  vi.setSystemTime(new Date("2026-09-30T10:00:00Z"));expect(await networkRateHash()).not.toBe(first);
 });
});
