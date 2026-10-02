import "server-only";
import { z } from "zod";
import { getSiteUrl } from "@/lib/env";
import { readBoundedBody } from "@/lib/billing/webhook";
export const orderSchema=z.object({id:z.uuid(),title:z.string(),amount:z.number().int().positive(),currency:z.literal("inr"),provider_session_id:z.string().nullable(),payment_intent:z.string().nullable()});
export function commerceConfigured(){return !!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_WEBHOOK_SECRET;}
export async function stripeRequest(path:string,params?:URLSearchParams,idempotencyKey?:string){
 const key=process.env.STRIPE_SECRET_KEY;if(!key)throw new Error("Payments unavailable");
 const base=new URL(process.env.STRIPE_API_BASE??"https://api.stripe.com");
 if(base.origin!=="https://api.stripe.com" && !(process.env.ALLOW_LOCAL_SERVICES==="true"&&["127.0.0.1","localhost"].includes(base.hostname)))throw new Error("Invalid payment endpoint");
 const response=await fetch(new URL(path,base),{method:params?"POST":"GET",headers:{Authorization:`Bearer ${key}`,"Stripe-Version":"2024-12-18.acacia",...(params?{"Content-Type":"application/x-www-form-urlencoded"}:{}),...(idempotencyKey?{"Idempotency-Key":idempotencyKey}:{})},body:params,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 const text=await readBoundedBody(response,1000000);
 if(!response.ok)throw new Error(`Payment provider HTTP ${response.status}`);
 return JSON.parse(text) as unknown;
}
export async function checkoutSession(order:z.infer<typeof orderSchema>,email:string){
 const site=getSiteUrl();
 if(!site.startsWith("https://") && process.env.ALLOW_LOCAL_SERVICES!=="true")throw new Error("HTTPS site URL required");
 const params=new URLSearchParams({mode:"payment",client_reference_id:order.id,customer_email:email,success_url:`${site}/orders?checkout=complete`,cancel_url:`${site}/orders`,"metadata[order_id]":order.id,"line_items[0][quantity]":"1","line_items[0][price_data][currency]":order.currency,"line_items[0][price_data][unit_amount]":String(order.amount),"line_items[0][price_data][product_data][name]":order.title});
 const raw=order.provider_session_id?await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(order.provider_session_id)}`):await stripeRequest("/v1/checkout/sessions",params,`checkout:${order.id}`);
 const session=z.object({id:z.string().regex(/^cs_[a-zA-Z0-9_]+$/),url:z.url().nullable(),status:z.string().optional()}).parse(raw);
 if(!session.url||session.status==="expired")throw new Error("Checkout expired. Please try again later.");
 const destination=new URL(session.url);
 if(destination.origin!=="https://checkout.stripe.com" && !(process.env.ALLOW_LOCAL_SERVICES==="true"&&["localhost","127.0.0.1"].includes(destination.hostname)))throw new Error("Invalid checkout destination");
 return session;
}
