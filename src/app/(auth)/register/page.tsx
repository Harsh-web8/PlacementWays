import { safeNextPath } from "@/lib/auth/paths";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard
      title="Create your account"
      description="Free to start. Track your progress across mock tests and practice."
      footer={<>Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-[var(--color-ink)] underline underline-offset-4 decoration-[var(--color-accent)]">Log in</Link></>}
    >
      <RegisterForm next={next} />
    </AuthCard>
  );
}
