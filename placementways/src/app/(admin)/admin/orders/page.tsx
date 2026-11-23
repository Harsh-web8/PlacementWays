import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/learning/action-form";
import { refundOrder } from "@/server/billing/actions";
export default async function Page({searchParams}:PageProps<"/admin/orders">){
 await requireAdmin();const sp=await searchParams;const page=Math.min(10000,Math.max(1,Math.trunc(Number(sp.page))||1));
 const {data,error,count}=await (await createClient()).from("purchase_orders").select("*",{count:"exact"}).order("created_at",{ascending:false}).order("id").range((page-1)*25,page*25-1);
 if(error)throw new Error("Could not load orders.");return <div className="space-y-6"><h1 className="font-serif text-4xl">Orders and refunds</h1><p>Full refunds revoke only the access granted by that purchase after provider confirmation.</p>{data.map(o=><section className="space-y-3 rounded border p-5" key={o.id}><h2 className="font-semibold">{o.title}</h2><p>₹{(o.amount/100).toFixed(2)} · {o.status.replaceAll("_"," ")}</p><p className="break-all text-xs">Order {o.id} · Student {o.user_id??"deleted account"}</p>{["paid","refund_pending"].includes(o.status)&&<ActionForm label={o.status==="paid"?"Request full refund":"Retry pending refund"} action={refundOrder.bind(null,o.id)} confirm="Request a full refund for this order?"/>}</section>)}<nav className="flex gap-6">{page>1&&<Link href={`?page=${page-1}`}>Previous</Link>}{page*25<(count??0)&&<Link href={`?page=${page+1}`}>Next</Link>}</nav></div>;
}
