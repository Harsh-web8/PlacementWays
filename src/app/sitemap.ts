import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv,getSiteUrl } from "@/lib/env";
import type { Database } from "@/types/database";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=getSiteUrl();const items:MetadataRoute.Sitemap=["/","/companies","/courses","/tests","/practice","/coding","/blog"].map(path=>({url:new URL(path,base).href}));
 const env=readSupabaseEnv();if(!env.ok)return items;
 // Always anonymous: an admin session can never add private/draft routes to the sitemap.
 const db=createClient<Database>(env.url,env.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const catalogs=[{table:"companies",path:"companies"},{table:"courses",path:"courses"},{table:"mock_tests",path:"tests"},{table:"blog_posts",path:"blog"}] as const;
 for(const catalog of catalogs){
  for(let start=0;;start+=1000){
   const {data,error}=await db.from(catalog.table).select("slug,updated_at").eq("status","published").order("id").range(start,start+999);
   if(error)throw new Error("Sitemap temporarily unavailable");
   for(const row of data)items.push({url:`${base}/${catalog.path}/${row.slug}`,lastModified:row.updated_at});
   if(data.length<1000)break;if(items.length>=49000)throw new Error("Sitemap needs partitioning before adding more content");
  }
 }
 for(let start=0;;start+=1000){
  const {data,error}=await db.from("practice_questions").select("slug").order("id").range(start,start+999);
  if(error)throw new Error("Sitemap temporarily unavailable");for(const row of data)if(row.slug)items.push({url:`${base}/questions/${row.slug}`});
  if(data.length<1000)break;if(items.length>=49000)throw new Error("Sitemap needs partitioning before adding more content");
 }
 return items;
}
