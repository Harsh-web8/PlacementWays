import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAttemptState } from "@/server/attempts/queries";
import { TestRunner } from "@/components/tests/test-runner";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AttemptPage({ params }: PageProps<"/attempts/[attemptId]">) {
  const { attemptId } = await params;

  const state = await getAttemptState(attemptId);
  if (!state) notFound();
  if (state.attempt.status !== "in_progress") redirect(`/attempts/${attemptId}/result`);

  return <TestRunner state={state} />;
}
