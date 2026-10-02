import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/env";
export function publicMetadata(title:string,description:string|null|undefined,path:string):Metadata{
 const url=new URL(path,getSiteUrl()).href;const summary=(description??"Prepare for placements with PlacementWays.").slice(0,180);
 return {title,description:summary,alternates:{canonical:url},openGraph:{title,description:summary,url,siteName:"PlacementWays",type:"website"},twitter:{card:"summary",title,description:summary}};
}
