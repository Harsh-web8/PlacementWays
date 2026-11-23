import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function Page({searchParams}:PageProps<"/coding/history">){
 const user=await requireUser();const sp=await searchParams;const page=Math.min(10000,Math.max(1,Math.trunc(Number(sp.page))||1));
 const {data,error,count}=await (await createClient()).from("coding_submissions").select("id,status,kind,passed,total,language_key,created_at",{count:"exact"}).eq("user_id",user.id).order("created_at",{ascending:false}).order("id").range((page-1)*25,page*25-1);
 if(error)throw new Error("Could not load history.");return <div className="space-y-6"><h1 className="font-serif text-4xl">Coding history</h1>{!data.length&&<p>No executions yet. <Link className="underline" href="/coding">Explore coding problems</Link></p>}<ul className="divide-y">{data.map(s=><li key={s.id} className="py-4"><Link href={`/coding/submissions/${s.id}`} className="underline">{s.kind} · {s.language_key} · {s.status.replaceAll("_"," ")} · {s.passed}/{s.total}</Link><p>{new Date(s.created_at).toLocaleString("en-IN",{timeZone:"UTC"})} UTC</p></li>)}</ul><nav className="flex justify-between">{page>1&&<Link href={`?page=${page-1}`}>Previous</Link>}{page*25<(count??0)&&<Link href={`?page=${page+1}`}>Next</Link>}</nav></div>;
}
