import { describe, expect, it } from "vitest";
import { mockTestSchema } from "@/lib/validation/mock-test";
const base = { title:"Sample",slug:"sample",description:"",instructions:"",durationMinutes:"30",difficulty:"easy",isFree:"true",companyId:"",accessType:"GUEST_FREE",guestAttemptAllowed:"true",guestAttemptLimit:"1",authenticatedAttemptLimit:"",pricePaise:"0" };
describe("admin mock access inputs",()=>{
  it("accepts unlimited authenticated attempts and a one-guest allowance",()=>{
    expect(mockTestSchema.parse(base)).toMatchObject({guestAttemptLimit:1,authenticatedAttemptLimit:null,guestAttemptAllowed:true});
  });
  it.each([['guestAttemptLimit','-1'],['guestAttemptLimit','101'],['guestAttemptLimit','1.5'],['authenticatedAttemptLimit','10001'],['authenticatedAttemptLimit','NaN'],['pricePaise','-1'],['accessType','unknown'],['guestAttemptAllowed','yes']])("rejects invalid %s=%s",(key,value)=>{
    expect(mockTestSchema.safeParse({...base,[key]:value}).success).toBe(false);
  });
  it("permits zero to disable starts",()=>{
    expect(mockTestSchema.parse({...base,guestAttemptLimit:'0',authenticatedAttemptLimit:'0'})).toMatchObject({guestAttemptLimit:0,authenticatedAttemptLimit:0});
  });
});
