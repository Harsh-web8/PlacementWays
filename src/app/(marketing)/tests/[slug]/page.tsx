import { PurchaseButton } from "@/components/billing-purchase";
import { publicMetadata } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Clock, FileQuestion, Award, ShieldAlert, Users } from "lucide-react";
import {
  getPublishedTestBySlug,
  getActiveAttemptId,
} from "@/server/tests/queries";
import { getCurrentUser } from "@/server/auth/session";
import { startAttempt } from "@/server/attempts/actions";
import { StartTestForm } from "@/components/tests/start-test-form";
import { RegistrationPrompt } from "@/components/tests/registration-prompt";
import { mockAccess } from "@/server/access/decisions";

export async function generateMetadata({
  params,
}: PageProps<"/tests/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const test = await getPublishedTestBySlug(slug);
  return publicMetadata(test?.title ?? "Mock test",test?.description,`/tests/${slug}`);
}

export default async function TestInstructionsPage({
  params,
}: PageProps<"/tests/[slug]">) {
  const { slug } = await params;
  const test = await getPublishedTestBySlug(slug);
  if (!test) notFound();

  const decision = await mockAccess(test.id);
  const user = await getCurrentUser();
  const activeAttemptId = user ? await getActiveAttemptId(test.id, user.id) : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:px-8">
      {test.companyName && test.companySlug && (
        <Link
          href={`/companies/${test.companySlug}`}
          className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]"
        >
          {test.companyName}
        </Link>
      )}
      <h1 className="mt-2 font-serif text-4xl tracking-tight">{test.title}</h1>
      {test.description && (
        <p className="mt-4 text-[var(--color-ink)]/70">{test.description}</p>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-sm border border-[var(--color-line)] bg-white p-5 sm:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-[var(--color-ink)]/60">
            <Clock aria-hidden className="size-3.5" /> Duration
          </dt>
          <dd className="mt-1 font-serif text-2xl">
            {test.durationMinutes} min
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-[var(--color-ink)]/60">
            <FileQuestion aria-hidden className="size-3.5" /> Questions
          </dt>
          <dd className="mt-1 font-serif text-2xl">{test.questionCount}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-[var(--color-ink)]/60">
            <Award aria-hidden className="size-3.5" /> Total marks
          </dt>
          <dd className="mt-1 font-serif text-2xl">{test.totalMarks}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-[var(--color-ink)]/60">
            <Users aria-hidden className="size-3.5" /> Attempts
          </dt>
          <dd className="mt-1 font-serif text-2xl">{test.attemptCount}</dd>
        </div>
      </dl>

      {test.topics.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-[var(--color-ink)]/70">
            Topics covered
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {test.topics.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--color-ink)]/6 px-3 py-1 text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3 rounded-sm border border-[var(--color-line)] bg-white p-5 text-sm leading-6">
        <h2 className="font-medium">Scoring rules</h2>
        <p className="text-[var(--color-ink)]/70">
          Marks vary by question.{" "}
          {test.hasNegativeMarking ? (
            <span className="inline-flex items-center gap-1 font-medium text-[var(--color-danger)]">
              <ShieldAlert aria-hidden className="size-3.5" /> Wrong answers on
              some questions lose marks.
            </span>
          ) : (
            "There is no negative marking on this test."
          )}{" "}
          An unanswered question always scores zero.
        </p>
        {test.instructions && (
          <p className="whitespace-pre-wrap text-[var(--color-ink)]/70">
            {test.instructions}
          </p>
        )}
        <p className="text-xs text-[var(--color-ink)]/50">
          The timer runs on our server, not your browser, and continues even if
          you close the tab. We take reasonable steps against cheating, but no
          online test can prevent it completely -- please attempt this test
          honestly.
        </p>
      </div>

      <div className="mt-8">
        {decision === "allow" ? <StartTestForm action={startAttempt.bind(null, test.id)} resuming={!!activeAttemptId} />
          : decision === "login" ? <RegistrationPrompt next={`/tests/${slug}`} />
          : decision === "premium" ? <><p className="mb-4">This mock requires premium access{test.pricePaise ? ` (₹${test.pricePaise / 100})` : ""}.</p>{user && <PurchaseButton kind="test" id={test.id}/>} {!user && <RegistrationPrompt next={`/tests/${slug}`} />}</>
          : <p>{decision === "limit" ? "You have reached the attempt limit for this mock. Explore another mock or continue your courses." : "This mock is temporarily unavailable. Please try again later."}</p>}
        {decision === "allow" && !user && <p className="mt-4 text-sm">Try your first eligible free mock without an account. Your result stays available in this browser for 30 days. Create an account to save it.</p>}
      </div>
    </div>
  );
}
