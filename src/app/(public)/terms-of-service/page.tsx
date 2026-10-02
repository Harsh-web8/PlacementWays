import { publicSettings } from "@/server/settings";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default async function TermsOfServicePage() {
  const settings = await publicSettings();
  return (
    <div className="mx-auto max-w-3xl px-6 py-14 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">Legal</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Terms of Service</h1>
      <p className="mt-4 text-sm text-[var(--color-ink)]/60">
        Draft — last updated 25 September 2026. PlacementWays is in early development; these terms will
        be reviewed before a public launch.
      </p>

      <div className="prose-legal mt-10 space-y-8 text-sm leading-7 text-[var(--color-ink)]/80">
        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">1. What PlacementWays is</h2>
          <p className="mt-3">
            PlacementWays is a practice and preparation platform for Indian college students preparing
            for IT company placements. It provides company-wise recruitment information, mock tests,
            aptitude and reasoning practice, verbal ability practice, programming and SQL practice, and
            performance analytics.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">2. No guarantee of placement or results</h2>
          <p className="mt-3">
            PlacementWays is a preparation tool, not a recruiter or a placement agency. We do not
            guarantee that you will be shortlisted, selected, or hired by any company, and we do not
            guarantee any specific score or outcome in any examination. Recruitment processes, test
            patterns and eligibility criteria are set by the hiring companies and can change at any
            time; where we publish this information, we include a source link and the date it was last
            verified, but we cannot guarantee it is current or complete.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">3. Your account</h2>
          <p className="mt-3">
            You must provide accurate information when creating an account and keep your login
            credentials confidential. You are responsible for activity that happens under your account.
            Accounts are intended for individual students; you may not share an account or create one on
            behalf of someone else without their permission.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">4. Acceptable use</h2>
          <p className="mt-3">When using PlacementWays, you agree not to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Attempt to bypass, disable, or interfere with test timers, scoring, or access controls.</li>
            <li>Copy, scrape, redistribute, or resell question content or recruitment-process data.</li>
            <li>Use automated tools to create accounts or submit test attempts.</li>
            <li>Attempt to access another student&apos;s data or the admin dashboard without authorization.</li>
            <li>Upload or submit content that is unlawful, abusive, or infringes someone else&apos;s rights.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">5. Mock tests and academic integrity</h2>
          <p className="mt-3">
            We apply reasonable technical measures to keep mock-test attempts fair — for example,
            server-side scoring, server-side timers, and validation that answers belong to the correct
            attempt. We cannot guarantee that cheating is completely prevented, and we do not represent
            mock-test scores as a certified or verified qualification.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">6. Free and paid features</h2>
          <p className="mt-3">
            Public discovery and eligible preparation content are free. Optional paid courses and mocks show their price before checkout. Access is granted after payment confirmation. Contact support about a refund; a confirmed full refund removes access granted by that purchase. The operator must publish its refund eligibility and timing policy before accepting payments.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">7. Content accuracy</h2>
          <p className="mt-3">
            We try to keep recruitment-process information and question content accurate, but errors are
            possible. If you notice something that looks outdated or incorrect, please let us know so we
            can review it.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">8. Suspension and termination</h2>
          <p className="mt-3">
            We may suspend or terminate an account that violates these terms, for example by attempting
            to bypass test integrity controls or accessing another student&apos;s data. You may stop using
            PlacementWays and request deletion of your account at any time.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">9. Limitation of liability</h2>
          <p className="mt-3">
            PlacementWays is provided on an &quot;as is&quot; basis, without warranties of any kind. To the extent
            permitted by law, we are not liable for placement outcomes, examination results, or
            decisions made by any third-party company based on information found on this platform.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">10. Changes to these terms</h2>
          <p className="mt-3">
            We may update these terms as the platform develops. Material changes will be reflected by
            updating the date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">11. Governing law</h2>
          <p className="mt-3">
            These terms are governed by the laws of India, without regard to conflict-of-law principles.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">12. Contact</h2>
          {/* TODO before launch: replace with a real, monitored support address. */}
          <p className="mt-3">
            Questions about these terms can be sent to{" "}
            {settings?.support_email ? <a className="underline" href={`mailto:${settings.support_email}`}>{settings.support_email}</a> : "the support contact listed by the site operator"}.
          </p>
        </section>
      </div>
    </div>
  );
}
