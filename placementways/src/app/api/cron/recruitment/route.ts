import { NextResponse } from "next/server";
import { secureTokenMatches, scanRecruitmentSources } from "@/server/recruitment/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Configure a scheduler to POST with Authorization: Bearer <RECRUITMENT_CRON_SECRET>. */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? null;
  if (!secureTokenMatches(token, process.env.RECRUITMENT_CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await scanRecruitmentSources(4);
    return NextResponse.json({ scanned: results.length, results });
  } catch (error) {
    console.error("[recruitment] scheduler scan failed", error);
    return NextResponse.json({ error: "Recruitment monitor failed" }, { status: 503 });
  }
}
