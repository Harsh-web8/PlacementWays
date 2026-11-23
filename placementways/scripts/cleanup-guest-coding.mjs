/** Execute only as a private scheduled worker. Never expose the service key in a browser. */
import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Supabase server credentials are required');process.exit(1);}
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await db.rpc('purge_guest_coding_history');
if(error){console.error('Guest coding cleanup unavailable:',error.code);process.exit(1);}
console.log(`Guest coding cleanup completed. Removed ${data} expired submissions.`);
