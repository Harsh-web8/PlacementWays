import { createClient } from "@/lib/supabase/server";
import { commerceConfigured } from "@/server/billing/stripe";
import { purchaseContent } from "@/server/billing/actions";
import { ActionForm } from "@/components/learning/action-form";
export async function PurchaseButton({kind,id}:{kind:"test"|"course";id:string}){
 if(!commerceConfigured())return null;
 const {data}=await (await createClient()).from("site_settings").select("commerce_enabled").eq("id",true).single();
 return data?.commerce_enabled?<ActionForm label="Purchase access" action={purchaseContent.bind(null,kind,id)}/>:null;
}
