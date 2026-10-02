import {notFound} from "next/navigation";
import {z} from "zod";
import {requireAdmin} from "@/server/auth/session";
import {createClient} from "@/lib/supabase/server";
import {LearningForm} from "@/components/admin/learning-form";
import {ActionForm} from "@/components/learning/action-form";
import {savePost,deletePost} from "@/server/admin/platform/actions";
export default async function Page({params}:PageProps<"/admin/blog/[postId]">){await requireAdmin();const {postId}=await params;const id=postId==="new"?null:postId;let values:Record<string,string>={status:"draft"};if(id){if(!z.uuid().safeParse(id).success)notFound();const db=await createClient();const {data,error}=await db.from("blog_posts").select("title,slug,description,body,status").eq("id",id).maybeSingle();if(error)throw new Error("Could not load post.");if(!data)notFound();values=data;}return <div className="space-y-6"><h1 className="font-serif text-4xl">{id?"Edit":"Create"} post</h1><LearningForm action={savePost.bind(null,id)} values={values} fields={[{name:"title",label:"Title"},{name:"slug",label:"Slug"},{name:"description",label:"Summary",type:"textarea"},{name:"body",label:"Article (plain text)",type:"textarea"},{name:"status",label:"Status",options:["draft","published","archived"].map(value=>({value,label:value}))}]}/>{id&&<ActionForm action={deletePost.bind(null,id)} label="Delete post" confirm="Delete this post?"/>}</div>;}
