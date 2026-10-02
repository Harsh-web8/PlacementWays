import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
export default function robots():MetadataRoute.Robots{
 if(process.env.DEPLOYMENT_ENV!=="production")return {rules:{userAgent:"*",disallow:"/"}};
 return {rules:{userAgent:"*",allow:"/",disallow:["/admin","/dashboard","/profile","/progress","/attempts","/practice/results","/coding/submissions","/coding/history","/orders","/login","/register","/auth","/api/"]},sitemap:`${getSiteUrl()}/sitemap.xml`};
}
