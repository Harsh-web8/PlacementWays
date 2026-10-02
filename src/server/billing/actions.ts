"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser,requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { checkoutSession,commerceConfigured,orderSchema,stripeRequest } from "./stripe";
import type { FormState } from "@/lib/form-state";
export async function purchaseContent(kind:"test"|"course",id:string,_prev:FormState,_form:FormData):Promise<FormState>{
 const user=await requireUser();if(!commerceConfigured())return {status:"error",message:"Purchases are not available yet."};
 if(!z.uuid().safeParse(id).success||!["test","course"].includes(kind))return {status:"error",message:"Content unavailable."};
 const {data,error}=await (await createClient()).rpc("create_purchase_order",{p_kind:kind,p_content_id:id});
 if(error)return {status:"error",message:error.code==="23514"?error.message:"Could not prepare checkout."};
 let url:string;
 try{const order=orderSchema.parse(data);const session=await checkoutSession(order,user.email);const attached=await serviceClient().rpc("attach_checkout_session",{p_order_id:order.id,p_session_id:session.id});if(attached.error||!attached.data)throw new Error();url=session.url!;}
 catch{return {status:"error",message:"Checkout could not be opened. Your access changes only after a verified payment. Please try again."};}
 redirect(url);
}
export async function refundOrder(id:string,_prev:FormState,_form:FormData):Promise<FormState>{
 await requireAdmin();if(!z.uuid().safeParse(id).success||!commerceConfigured())return {status:"error",message:"Refunds are unavailable."};
 const {data,error}=await (await createClient()).rpc("request_order_refund",{p_order_id:id});
 if(error)return {status:"error",message:"This order cannot be refunded."};
 try{const order=orderSchema.parse(data);if(!order.payment_intent)throw new Error();await stripeRequest("/v1/refunds",new URLSearchParams({payment_intent:order.payment_intent}),`refund:${order.id}`);}
 catch{return {status:"error",message:"Refund remains pending. Retry safely to check/send the same refund request."};}
 revalidatePath("/admin/orders");return {status:"success",message:"Refund requested. Access is revoked once the provider confirms the full refund."};
}
