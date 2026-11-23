import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function Page({searchParams}:PageProps<"/admin/activity">){
 await requireAdmin();const sp=await searchParams;const page=Math.min(10000,Math.max(1,Math.trunc(Number(sp.page))||1));const action=typeof sp.action==="string"?sp.action.slice(0,100):"";
 let query=(await createClient()).from("audit_logs").select("id,actor_id,action,entity_type,entity_id,metadata,created_at",{count:"exact"}).order("created_at",{ascending:false}).order("id").range((page-1)*50,page*50-1);
 if(action)query=query.eq("action",action);const {data,error,count}=await query;if(error)throw new Error("Could not load activity.");
 const href=(p:number)=>`?${new URLSearchParams({page:String(p),action})}`;
 return <div className="space-y-5"><h1 className="font-serif text-4xl">Admin activity</h1><form><label>Exact action <input name="action" defaultValue={action} className="rounded border p-2"/></label><button className="ml-3 underline">Filter</button></form><p>{count??0} events</p>{data.map(e=><article key={e.id} className="rounded border p-4"><h2 className="font-semibold">{e.action}</h2><p>{e.created_at} · {e.entity_type}</p><p className="break-all text-xs">Actor: {e.actor_id??"deleted account"} · Item: {e.entity_id}</p><pre className="overflow-x-auto text-xs">{JSON.stringify(e.metadata,null,2)}</pre></article>)}<nav className="flex gap-6">{page>1&&<Link href={href(page-1)}>Previous</Link>}{page*50<(count??0)&&<Link href={href(page+1)}>Next</Link>}</nav></div>;
}
