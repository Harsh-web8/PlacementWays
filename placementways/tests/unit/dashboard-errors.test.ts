import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ failure: "", attemptReads: 0 }));
vi.mock("@/server/auth/session", () => ({ requireUser: async () => ({ id:"student",name:"Student",college:null,degree:null,graduationYear:null }) }));
vi.mock("@/server/learning/queries", () => ({ getLearningProgress: async () => ({courses:[],completed:new Set()}),getSyllabus:vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({from:(table:string)=>{
  const read = table === "test_attempts" ? (++fixture.attemptReads === 1 ? "count" : "recent") : "titles";
  const query = {select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,in:()=>query,
    then:(resolve:(value:unknown)=>unknown)=>resolve({count:1,data: read === "recent" ? [{test_id:"test"}] : [],error:fixture.failure === read ? {code:"outage"} : null})};
  return query;
}}) }));
import Dashboard from "@/app/(student)/dashboard/page";
beforeEach(()=>{fixture.attemptReads=0;fixture.failure="";});
it.each(["count","recent","titles"])("surfaces %s failures instead of displaying empty history",async(failure)=>{
  fixture.failure=failure;
  await expect(Dashboard({params:Promise.resolve({}),searchParams:Promise.resolve({})})).rejects.toThrow("Unable to load");
});
