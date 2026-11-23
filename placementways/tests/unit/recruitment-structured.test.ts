import { describe, expect, it } from "vitest";
import { makeFieldCandidates, validatedFieldValue, type Scope } from "../../src/server/recruitment/structured";

const roleId = "11111111-1111-4111-8111-111111111111";
const driveId = "22222222-2222-4222-8222-222222222222";
const roundId = "33333333-3333-4333-8333-333333333333";
const scope:Scope={
  role:{id:roleId,eligibility:"BE/BTech only",salary_details:null},
  drive:{id:driveId,closes_at:"2026-11-25T18:00:00+05:30",drive_status:"open"},
  rounds:[{id:roundId,round_number:1,name:"Online assessment",round_type:"assessment",description:null,topics:[],question_count:null,duration_minutes:60,marking_rules:null}],
};
const base={headline:"Recruitment changes",summary:"Application deadlines and assessment details changed.",evidence:"Applications now close on 2026-12-01",classification:"deadline"};

const candidate=(changes:unknown[],text="Applications now close on 2026-12-01 and this year's online assessment has 40 questions")=>
  makeFieldCandidates({...base,field_changes:changes},text,scope,roleId,driveId);

describe("recruitment structured proposals",()=>{
  it("requires a verbatim quote from the new snapshot",()=>{
    const changes=[{target_kind:"round",round_number:1,field_key:"question_count",value:40,evidence_quote:"online assessment has 40 questions"}];
    expect(candidate(changes)).toMatchObject([{target_kind:"round",target_id:roundId,field_key:"question_count",old_value:null,new_value:40}]);
    expect(candidate(changes,"The old portal has been archived")).toEqual([]);
  });
  it("never lets the model choose arbitrary UUIDs, unsupported fields or impossible values",()=>{
    const changes=[
      {target_kind:"role",field_key:"status",value:"archived",evidence_quote:"Applications now close on 2026-12-01"},
      {target_kind:"round",round_number:99,field_key:"question_count",value:40,evidence_quote:"Applications now close on 2026-12-01"},
      {target_kind:"round",round_number:1,field_key:"duration_minutes",value:-200,evidence_quote:"Applications now close on 2026-12-01"},
    ];
    expect(candidate(changes)).toEqual([]);
  });
  it("rejects fabricated timestamps without timezone and unsafe URLs",()=>{
    expect(validatedFieldValue("drive","closes_at","2026-12-01")).toBeNull();
    expect(validatedFieldValue("drive","closes_at","2026-12-01T18:30:00+05:30")).toBe("2026-12-01T13:00:00.000Z");
    expect(validatedFieldValue("drive","application_url","http://127.0.0.1/")).toBeNull();
  });
  it("supports proposed new selection rounds only on attached drives",()=>{
    const text="Round 2 is a technical interview about Java";
    const change={target_kind:"round_new",round_number:2,field_key:"create",value:{round_number:2,name:"Technical Interview",round_type:"interview",topics:["Java"]},evidence_quote:"Round 2 is a technical interview"};
    const output=candidate([change],text);
    expect(output).toHaveLength(1);
    expect(output[0].target_id).toBe(driveId);
    expect(makeFieldCandidates({...base,field_changes:[change]},text,scope,roleId,null)).toEqual([]);
  });
  it("drops duplicates and unchanged values",()=>{
    const change={target_kind:"drive",field_key:"drive_status",value:"open",evidence_quote:"Applications now close on 2026-12-01"};
    expect(candidate([change,change])).toEqual([]);
    const changed={...change,value:"closed"};
    expect(candidate([changed,changed])).toHaveLength(1);
  });
});
