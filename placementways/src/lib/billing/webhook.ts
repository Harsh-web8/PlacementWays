import { createHmac,timingSafeEqual } from "node:crypto";
/** Verify raw bytes BEFORE JSON parsing. Support key rotation's multiple v1 signatures. */
export function verifyStripeSignature(raw:string,header:string|null,secret:string,now=Date.now()):boolean{
 if(!header||!secret||header.length>2000)return false;
 const parts=header.split(",").map(p=>p.split("="));const timestamp=parts.find(([k])=>k==="t")?.[1];
 if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
 const expected=createHmac("sha256",secret).update(`${timestamp}.${raw}`).digest();
 return parts.some(([k,v])=>k==="v1"&&/^[a-f0-9]{64}$/.test(v??"")&&timingSafeEqual(expected,Buffer.from(v,"hex")));
}
export async function readBoundedBody(request:Pick<Request,"body">,limit=128000):Promise<string>{
 const reader=request.body?.getReader();if(!reader)return "";let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error("Payload too large");chunks.push(value);}}
 finally{await reader.cancel();}
 return Buffer.concat(chunks).toString("utf8");
}
