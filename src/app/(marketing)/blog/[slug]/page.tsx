import { publicMetadata } from "@/lib/seo";
import Link from "next/link";
import {notFound} from "next/navigation";
import {getPost} from "@/server/blog";
export default async function Page({params}:PageProps<"/blog/[slug]">){const post=await getPost((await params).slug);if(!post)notFound();return <article className="mx-auto max-w-3xl space-y-6 px-6 py-12"><Link className="underline" href="/blog">Preparation guides</Link><h1 className="font-serif text-4xl">{post.title}</h1><p>{post.description}</p><div className="whitespace-pre-wrap break-words leading-8">{post.body}</div></article>;}

export async function generateMetadata({params}:PageProps<"/blog/[slug]">){const {slug}=await params;const item=await getPost(slug);return publicMetadata(item?.title??"Post",item?.description,`/blog/${slug}`);}
