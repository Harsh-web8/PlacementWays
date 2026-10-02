import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // Only reachable through a valid recovery link, which creates a session.
  const session = await getSession();
  if (session.state === "anonymous") redirect("/forgot-password?error=expired");
  return (
    <AuthCard title="Choose a new password" description="You'll be signed out of your other devices.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
