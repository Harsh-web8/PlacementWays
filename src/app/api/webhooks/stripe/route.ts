import { z } from "zod";
import { readBoundedBody,verifyStripeSignature } from "@/lib/billing/webhook";
import { serviceClient } from "@/lib/supabase/service";
const eventSchema=z.object({id:z.string().min(1).max(200),type:z.string(),livemode:z.boolean(),data:z.object({object:z.record(z.string(),z.unknown())})});
export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret)return new Response("Unavailable",{status:503});
 let raw:string;try{raw=await readBoundedBody(request);}catch{return new Response("Payload too large",{status:413});}
 if(!verifyStripeSignature(raw,request.headers.get("stripe-signature"),secret))return new Response("Invalid signature",{status:400});
 let event:z.infer<typeof eventSchema>;try{event=eventSchema.parse(JSON.parse(raw));}catch{return new Response("Invalid event",{status:400});}
 if(event.livemode!==(process.env.STRIPE_LIVE_MODE==="true"))return new Response("Wrong payment mode",{status:400});
 const obj=event.data.object;let action:string;let amount:unknown;let session:string|null=null;
 if(["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type)){
  if(obj.payment_status!=="paid"||obj.mode!=="payment")return Response.json({received:true});
  action="pay";amount=obj.amount_total;session=typeof obj.id==="string"?obj.id:null;
 }else if(event.type==="charge.refunded"){
  if(obj.refunded!==true||obj.amount_refunded!==obj.amount)return Response.json({received:true});
  action="refund";amount=obj.amount_refunded;
 }else if(event.type==="refund.failed"){action="refund_failed";amount=obj.amount;}
 else return Response.json({received:true});
 const parsed=z.object({amount:z.number().int().positive(),currency:z.literal("inr"),paymentIntent:z.string().regex(/^pi_[a-zA-Z0-9_]+$/)}).safeParse({amount,currency:obj.currency,paymentIntent:obj.payment_intent});
 if(!parsed.success)return new Response("Invalid payment",{status:400});
 try{const {data,error}=await serviceClient().rpc("apply_payment_event",{p_event_id:event.id,p_action:action,p_session_id:session,p_payment_intent:parsed.data.paymentIntent,p_amount:parsed.data.amount,p_currency:parsed.data.currency});if(error||!data)return new Response("Retry delivery",{status:503});}
 catch{return new Response("Retry delivery",{status:503});}
 return Response.json({received:true});
}
