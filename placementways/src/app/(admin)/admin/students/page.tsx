import Link from "next/link";
import {requireAdmin} from "@/server/auth/session";
import {createClient} from "@/lib/supabase/server";
import {ActionButton} from "@/components/admin/action-button";
import {setStudentActive} from "@/server/admin/platform/actions";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
export default async function Page({searchParams}:PageProps<"/admin/students">){
 await requireAdmin();const sp=await searchParams;const q=typeof sp.q==="string"?sp.q.slice(0,100):"";const page=Math.min(10000,Math.max(1,Math.floor(Number(sp.page)||1)));const db=await createClient();
 let query=db.from("profiles").select("id,name,email,is_active,created_at",{count:"exact"}).eq("role","student").order("created_at",{ascending:false}).order("id").range((page-1)*25,page*25-1);
 if(q)query=query.ilike("email",`%${q.replace(/[%_\\]/g,"\\$&")}%`);const {data,error,count}=await query;if(error)throw new Error("Could not load students.");
 return <div className="space-y-6"><h1 className="font-serif text-4xl">Students</h1><form className="flex gap-3"><label className="flex-1">Email search<Input name="q" defaultValue={q}/></label><Button className="self-end">Search</Button></form><p>{count??0} students</p><ul className="divide-y">{data.map(s=><li key={s.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><h2 className="font-semibold">{s.name||"Student"}</h2><p>{s.email}</p><p>{s.is_active?"Active":"Suspended"}</p></div><ActionButton action={setStudentActive.bind(null,s.id,!s.is_active)} confirmMessage={s.is_active?"Suspend this student's access? Their records will be retained.":undefined}>{s.is_active?"Suspend access":"Restore access"}</ActionButton></li>)}</ul><nav className="flex justify-between" aria-label="Student pages"><span>{page>1&&<Link href={`?${new URLSearchParams({q,page:String(page-1)})}`}>Previous</Link>}</span><span>{page*25<(count??0)&&<Link href={`?${new URLSearchParams({q,page:String(page+1)})}`}>Next</Link>}</span></nav></div>;
}
