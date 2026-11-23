import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  const sp = await props.searchParams;
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new password."
      footer={<Link href="/login" className="font-medium text-[var(--color-ink)] underline underline-offset-4 decoration-[var(--color-accent)]">Back to log in</Link>}
    >
      {sp.error === "expired" && (
        <Alert variant="error" className="mb-5">Your reset link is invalid or has expired. Request a new one below.</Alert>
      )}
      <ForgotPasswordForm />
    </AuthCard>
  );
}
