// Local real-PostgreSQL integration. Synthetic Stripe-shaped signed events, no charges.
import assert from 'node:assert/strict';
import { createHmac,randomUUID } from 'node:crypto';
import pg from 'pg';
if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:54400'||!process.env.STRIPE_WEBHOOK_SECRET)throw new Error('Local access fixture and synthetic webhook secret required');
const db=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:5432/placementways_test'});await db.connect();
const order=(await db.query("select * from purchase_orders where provider_session_id is not null and status='pending' and user_id='11111111-1111-1111-1111-111111111111' limit 1")).rows[0];assert.ok(order,'prepare a synthetic order first');
const pi=`pi_${randomUUID().replaceAll('-','')}`;
const object={id:order.provider_session_id,mode:'payment',payment_status:'paid',amount_total:order.amount,currency:'inr',payment_intent:pi};
async function send(event,valid=true){const raw=JSON.stringify(event);const t=Math.floor(Date.now()/1000);const sig=createHmac('sha256',valid?process.env.STRIPE_WEBHOOK_SECRET:'wrong').update(`${t}.${raw}`).digest('hex');return fetch('http://localhost:3000/api/webhooks/stripe',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':`t=${t},v1=${sig}`},body:raw});}
try{
 const event={id:`evt_${randomUUID()}`,type:'checkout.session.completed',livemode:false,data:{object}};
 assert.equal((await send(event,false)).status,400,'forged signature rejected');
 assert.equal((await send({...event,livemode:true})).status,400,'live/test mismatch rejected');
 assert.equal((await send({...event,data:{object:{...object,amount_total:1}}})).status,503,'mismatched amount not granted');
 assert.equal((await send(event)).status,200,'valid purchase applied');assert.equal((await send(event)).status,200,'replay acknowledged');
 assert.equal((await db.query('select count(*)::int as n from content_entitlements where order_id=$1',[order.id])).rows[0].n,1);
 console.log('HTTP webhook: signature/mode/amount guards, verified grant and replay passed');
 const refund={id:`evt_${randomUUID()}`,type:'charge.refunded',livemode:false,data:{object:{payment_intent:pi,currency:'inr',amount:order.amount,amount_refunded:order.amount,refunded:true}}};
 assert.equal((await send(refund)).status,200);assert.equal((await db.query('select count(*)::int as n from content_entitlements where order_id=$1',[order.id])).rows[0].n,0);assert.equal((await db.query('select status from purchase_orders where id=$1',[order.id])).rows[0].status,'refunded');
 console.log('HTTP webhook: confirmed full refund revokes purchased access');
}finally{await db.end();}
