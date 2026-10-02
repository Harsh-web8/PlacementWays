import { requireAdmin } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LearningForm } from "@/components/admin/learning-form";
import { saveCodingSettings,saveLanguage } from "@/server/coding/actions";
export default async function Page(){
 await requireAdmin();const db=await createClient();const [settings,languages,worker]=await Promise.all([db.from("site_settings").select("coding_enabled,coding_hourly_limit,coding_daily_limit").eq("id",true).single(),db.from("coding_languages").select("*").order("key"),db.from("worker_heartbeats").select("last_seen").eq("name","coding").maybeSingle()]);
 if(settings.error||languages.error||worker.error)throw new Error("Could not load coding settings.");
 const options=[{value:"true",label:"Enabled"},{value:"false",label:"Disabled"}];
 return <div className="space-y-8"><h1 className="font-serif text-4xl">Coding execution</h1><p>Worker: {worker.data?`last seen ${worker.data.last_seen}`:"not connected"}. Execution requires a worker heartbeat within the last two minutes.</p><LearningForm action={saveCodingSettings} values={Object.fromEntries(Object.entries(settings.data).map(([k,v])=>[k,String(v)]))} fields={[{name:"coding_enabled",label:"Execution",options},{name:"coding_hourly_limit",label:"Executions per account per hour",type:"number"},{name:"coding_daily_limit",label:"Executions per account per 24 hours",type:"number"}]}/><h2 className="font-serif text-2xl">Languages</h2><p>Match provider IDs to your execution service’s language catalog before enabling a language.</p>{languages.data.map(l=><section className="rounded border p-5" key={l.key}><h3>{l.key}</h3><LearningForm action={saveLanguage.bind(null,l.key)} values={{name:l.name,provider_id:String(l.provider_id),enabled:String(l.enabled)}} fields={[{name:"name",label:"Display name"},{name:"provider_id",label:"Provider language ID",type:"number"},{name:"enabled",label:"Availability",options}]}/></section>)}</div>;
}
