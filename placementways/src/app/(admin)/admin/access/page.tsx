import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LearningForm } from "@/components/admin/learning-form";
import { ActionForm } from "@/components/learning/action-form";
import { grantEntitlement, revokeEntitlement } from "@/server/admin/platform/entitlements";
export default async function Page() {
  await requireAdmin();
  const db=await createClient();
  const [grants,students,courses,tests]=await Promise.all([
    db.from("content_entitlements").select("id,user_id,test_id,course_id,expires_at").order("created_at",{ascending:false}).limit(200),
    db.from("profiles").select("id,name,email").eq("role","student").limit(500),
    db.from("courses").select("id,title").limit(500),
    db.from("mock_tests").select("id,title").limit(500),
  ]);
  if(grants.error || students.error || courses.error || tests.error)throw new Error("Could not load access grants.");
  return <div className="space-y-8"><h1 className="font-serif text-4xl">Premium access</h1><p>Grant verified purchases or complimentary access. Expired or revoked grants stop new premium activity.</p>
    <LearningForm action={grantEntitlement} values={{}} fields={[
      {name:"userId",label:"Student UUID",hint:"Copy from the student reference below."},
      {name:"kind",label:"Content type",options:[{value:"test",label:"Mock test"},{value:"course",label:"Course"}]},
      {name:"contentId",label:"Content UUID",hint:"Copy the matching mock or course ID below."},
      {name:"expiresAt",label:"Expiry (optional)",hint:"ISO date/time, e.g. 2027-12-31T23:59:59Z. Empty means no expiry."},
    ]}/>
    <details><summary>Student and content references (up to 500 each)</summary><ul>{students.data.map(s=><li key={s.id}>{s.name} ({s.email}): {s.id}</li>)}{tests.data.map(t=><li key={t.id}>Mock: {t.title}: {t.id}</li>)}{courses.data.map(c=><li key={c.id}>Course: {c.title}: {c.id}</li>)}</ul></details>
    <h2 className="font-serif text-2xl">Latest 200 grants</h2>{grants.data.map(g=><section key={g.id} className="space-y-2 rounded border p-4"><p>Student: {g.user_id}</p><p>{g.test_id ? "Mock" : "Course"}: {g.test_id ?? g.course_id}</p><p>Expires: {g.expires_at ?? "Never"}</p><ActionForm label="Revoke access" action={revokeEntitlement.bind(null,g.id)} confirm="Revoke this access grant?"/></section>)}
  </div>;
}
