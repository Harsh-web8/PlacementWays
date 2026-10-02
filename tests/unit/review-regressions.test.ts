import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CSV_FILE_BYTES, initialCsvImportState } from "@/lib/csv-import-state";
import { initialFormState } from "@/lib/form-state";

const fixture = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  writes: [] as Record<string, unknown>[],
  authorized: true,
  failReads: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/server/auth/session", () => ({ requireAdmin: async () => {
  if (!fixture.authorized) throw new Error("Unauthorized");
  return {id:"admin"};
} }));
vi.mock("@/server/admin/audit", () => ({ logAdminAction: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from: () => {
    let rows = [...fixture.rows];
    const query = {
      select: () => query,
      then: (resolve: (value: {data: Record<string,unknown>[];error:{code:string}|null}) => unknown) =>
        resolve({data:rows,error:fixture.failReads ? {code:"outage"} : null}),
      eq: (column: string, value: unknown) => { rows=rows.filter(r=>r[column] === value); return query; },
      order: (column: string, { ascending }: { ascending: boolean }) => { rows.sort((a,b) => (Number(a[column])-Number(b[column])) * (ascending ? 1 : -1)); return query; },
      limit: async (count: number) => ({data:rows.slice(0,count),error:fixture.failReads ? {code:"outage"} : null}),
      maybeSingle: async () => ({data:rows.length===1 ? rows[0] : null,error: fixture.failReads || rows.length>1 ? {code:"invalid"} : null}),
      single: async () => ({data:{id:"saved"},error:null}),
      insert: (value: Record<string,unknown>) => {fixture.writes.push(value);return query;},
      update: (value: Record<string,unknown>) => {fixture.writes.push(value);return query;},
    };
    return query;
  },
}) }));
import { createCategory, updateCategory } from "@/server/admin/categories/actions";
import { previewImport, confirmImport } from "@/server/admin/questions/csv-import";
import { addSource, setProcessStatus } from "@/server/admin/processes/actions";
import { logAdminAction } from "@/server/admin/audit";
import { getActiveAttemptId } from "@/server/tests/queries";

const subject="85000000-0000-4000-8000-000000000001";
const topic="85000000-0000-4000-8000-000000000002";
const other="85000000-0000-4000-8000-000000000003";
function categoryForm(parentId: string) {
  const form=new FormData();
  for(const [k,v] of Object.entries({name:"Percentages",slug:"percentages",description:"",parentId,sortOrder:"0"})) form.set(k,v);
  return form;
}
beforeEach(()=>{vi.clearAllMocks();fixture.rows=[];fixture.writes=[];fixture.authorized=true;fixture.failReads=false;});

describe("category hierarchy Server Actions",()=>{
  it("rejects missing, malformed and nested parents before writing",async()=>{
    fixture.rows=[{id:topic,parent_id:subject}];
    for(const parent of ["invalid",other,topic]) {
      expect((await createCategory(initialFormState,categoryForm(parent))).fieldErrors?.parentId).toBeDefined();
    }
    expect(fixture.writes).toHaveLength(0);
  });
  it("rejects moving a subject with children under another subject",async()=>{
    fixture.rows=[{id:subject,parent_id:null},{id:topic,parent_id:subject},{id:other,parent_id:null}];
    const result=await updateCategory(subject,initialFormState,categoryForm(other));
    expect(result.fieldErrors?.parentId?.[0]).toContain("subcategories");
    expect(fixture.writes).toHaveLength(0);
  });
  it("allows a leaf topic under a top-level subject",async()=>{
    fixture.rows=[{id:subject,parent_id:null},{id:topic,parent_id:null}];
    expect((await updateCategory(topic,initialFormState,categoryForm(subject))).status).toBe("success");
    expect(fixture.writes[0].parent_id).toBe(subject);
  });
  it("fails closed on parent lookup failure",async()=>{
    fixture.failReads=true;
    expect((await createCategory(initialFormState,categoryForm(subject))).status).toBe("error");
    expect(fixture.writes).toHaveLength(0);
  });
});

describe("CSV payload limits",()=>{
  it("rejects oversized files during preview",async()=>{
    const form=new FormData();form.set("file",new File(["x".repeat(MAX_CSV_FILE_BYTES+1)],"questions.csv"));
    expect((await previewImport(initialCsvImportState,form)).message).toContain("too large");
    expect(fixture.writes).toHaveLength(0);
  });
  it("counts UTF-8 bytes on confirmation, not JavaScript characters",async()=>{
    const form=new FormData();form.set("csvText","₹".repeat(Math.floor(MAX_CSV_FILE_BYTES/3)+1));
    expect((await confirmImport(initialCsvImportState,form)).message).toContain("too large");
    expect(fixture.writes).toHaveLength(0);
  });
  it("still authorizes before handling an import",async()=>{
    fixture.authorized=false;
    await expect(confirmImport(initialCsvImportState,new FormData())).rejects.toThrow("Unauthorized");
  });
});

it("returns only the signed-in admin's active attempt even with visibility of other students",async()=>{
  fixture.rows=[
    {id:"own",test_id:"test",user_id:"admin",status:"in_progress",expires_at:"2099-01-01T00:00:00Z"},
    {id:"other",test_id:"test",user_id:"student",status:"in_progress",expires_at:"2099-01-01T00:00:00Z"},
  ];
  expect(await getActiveAttemptId("test","admin")).toBe("own");
});

it("reports category query failures as retryable errors in both CSV steps",async()=>{
  fixture.failReads=true;
  const text="question,category\nExample,aptitude";
  const upload=new FormData();upload.set("file",new File([text],"questions.csv"));
  const confirmation=new FormData();confirmation.set("csvText",text);
  for(const result of [await previewImport(initialCsvImportState,upload),await confirmImport(initialCsvImportState,confirmation)]) {
    expect(result.status).toBe("error");
    expect(result.message).toContain("couldn't load categories");
    expect(result.message).not.toContain("Unknown category");
  }
  expect(fixture.writes).toHaveLength(0);
});


describe("recruitment process mutations",()=>{
  const sourceForm = () => { const form = new FormData(); form.set("label","Official careers"); form.set("url","https://example.com/careers"); return form; };
  it("appends sources after the largest order even after deletions",async()=>{
    fixture.rows=[{recruitment_process_id:subject,sort_order:2},{recruitment_process_id:subject,sort_order:7}];
    expect((await addSource(subject,other,initialFormState,sourceForm())).status).toBe("success");
    expect(fixture.writes[0].sort_order).toBe(8);
  });
  it("does not insert when the ordering query fails",async()=>{
    fixture.failReads=true;
    expect((await addSource(subject,other,initialFormState,sourceForm())).status).toBe("error");
    expect(fixture.writes).toHaveLength(0);
  });
  it("does not report or audit a status change for a missing process",async()=>{
    expect((await setProcessStatus(subject,other,"published",initialFormState,new FormData())).status).toBe("error");
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});
