import { publicSettings } from "@/server/settings";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPolicyPage() {
  const settings = await publicSettings();
  return (
    <div className="mx-auto max-w-3xl px-6 py-14 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">Legal</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Privacy Policy</h1>
      <p className="mt-4 text-sm text-[var(--color-ink)]/60">
        Draft — last updated 25 September 2026. PlacementWays is in early development; this policy will
        be reviewed before a public launch.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-[var(--color-ink)]/80">
        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">1. What this policy covers</h2>
          <p className="mt-3">
            This policy explains what information PlacementWays collects when you create an account and
            use the platform, why we collect it, and the choices available to you. We only collect
            information that is necessary to provide the service.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">2. Information we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><span className="font-medium text-[var(--color-ink)]">Account details:</span> name and email address, used to authenticate you and identify your account.</li>
            <li><span className="font-medium text-[var(--color-ink)]">Profile details you choose to add:</span> college, degree, graduation year, and companies or topics you are preparing for.</li>
            <li><span className="font-medium text-[var(--color-ink)]">Test activity:</span> mock-test attempts, answers, scores, and time spent, used to show you results and track your progress.</li>
            <li><span className="font-medium text-[var(--color-ink)]">Coding activity:</span> submitted source code, language and verdicts. Code and test inputs are sent to our isolated execution provider. Do not include passwords or other secrets in code.</li>
            <li><span className="font-medium text-[var(--color-ink)]">Guest attempts:</span> an opaque cookie and temporary server records identify your free attempt. A rotating keyed network hash limits obvious abuse without browser fingerprinting.</li>
            <li><span className="font-medium text-[var(--color-ink)]">Session data:</span> a login-session cookie used to keep you signed in. Permissions are checked on the server for each protected action.</li>
          </ul>
          <p className="mt-3">
            We do not ask for information we don&apos;t need for the product — for example, we do not
            collect government ID numbers. When purchases are enabled, Stripe collects payment details on its checkout page. We store the order amount, status and provider references, not your card number.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">3. How we use this information</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>To create and secure your account, and to tell students and admin accounts apart on the server (never based on anything sent from the browser).</li>
            <li>To show you your dashboard, attempt history, and performance analytics.</li>
            <li>To recommend practice topics based on your own past attempts.</li>
            <li>To maintain the security and reliability of the platform, including audit logs of admin actions.</li>
          </ul>
          <p className="mt-3">We do not sell your personal information, and we do not use it for advertising.</p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">4. Where data is stored</h2>
          <p className="mt-3">
            Data is stored in a PostgreSQL database with row-level security policies, so a student
            account can only read and edit its own data, and administrative actions are restricted to
            admin accounts and checked on the server.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">5. Sharing of information</h2>
          <p className="mt-3">
            Hosting and database providers process the data needed to operate the platform. For checkout,
            Stripe receives your email address and order details. Our Judge0-compatible execution
            provider receives submitted source code and test inputs to run and grade your solution.
            These services also apply their own privacy terms. We do not send your account profile to
            the execution provider.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">6. Your choices</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>You can view and update your profile details at any time from your account.</li>
            <li>You can request deletion of your account and associated data.</li>
            <li>You can log out at any time, which ends your session.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">7. Children&apos;s privacy</h2>
          <p className="mt-3">
            PlacementWays is intended for college students preparing for placements and is not directed
            at young children. We do not knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">8. Changes to this policy</h2>
          <p className="mt-3">
            We may update this policy as the platform develops. Material changes will be reflected by
            updating the date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">9. Contact</h2>
          {/* TODO before launch: replace with a real, monitored support address. */}
          <p className="mt-3">
            Questions about this policy, or requests to access or delete your data, can be sent to{" "}
            {settings?.support_email ? <a className="underline" href={`mailto:${settings.support_email}`}>{settings.support_email}</a> : "the support contact listed by the site operator"}.
          </p>
        </section>

        <p className="border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink)]/50">
          See also our{" "}
          <Link href="/terms-of-service" className="underline underline-offset-4 decoration-[var(--color-accent)]">
            Terms of Service
          </Link>.
        </p>
      </div>
    </div>
  );
}
