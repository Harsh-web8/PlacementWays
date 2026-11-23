import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function Page({searchParams}:PageProps<"/orders">){
 const user=await requireUser();const sp=await searchParams;const page=Math.min(10000,Math.max(1,Math.floor(Math.trunc(Number(sp.page))||1)));
 const {data,error,count}=await (await createClient()).from("purchase_orders").select("id,title,amount,currency,status,created_at",{count:"exact"}).eq("user_id",user.id).order("created_at",{ascending:false}).order("id").range((page-1)*25,page*25-1);
 if(error)throw new Error("Could not load orders.");return <div className="space-y-6"><h1 className="font-serif text-4xl">Your orders</h1>{sp.checkout==="complete"&&<p>Thank you. Access appears after payment confirmation. If the order is pending, refresh this page shortly.</p>}{!data.length&&<p>No purchases yet.</p>}{data.map(o=><section key={o.id} className="rounded border p-4"><h2 className="font-semibold">{o.title}</h2><p>₹{(o.amount/100).toFixed(2)} · {o.status.replaceAll("_"," ")}</p><p className="break-all text-xs">Order {o.id}</p></section>)}<nav className="flex gap-6">{page>1&&<Link href={`?page=${page-1}`}>Previous</Link>}{page*25<(count??0)&&<Link href={`?page=${page+1}`}>Next</Link>}</nav></div>;
}
