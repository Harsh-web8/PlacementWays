import "server-only";
import {createClient} from "@/lib/supabase/server";
import {readSupabaseEnv} from "@/lib/env";
export async function listPosts(page=1){if(!readSupabaseEnv().ok)return {posts:[],total:0};const db=await createClient();const {data,error,count}=await db.from("blog_posts").select("id,title,slug,description,created_at",{count:"exact"}).eq("status","published").order("created_at",{ascending:false}).order("id").range((page-1)*12,page*12-1);if(error)throw new Error("Articles are temporarily unavailable.");return {posts:data,total:count??0};}
export async function getPost(slug:string){if(!readSupabaseEnv().ok)return null;const db=await createClient();const {data,error}=await db.from("blog_posts").select("*").eq("slug",slug).eq("status","published").maybeSingle();if(error)throw new Error("Article is temporarily unavailable.");return data;}
