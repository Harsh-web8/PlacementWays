import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/auth/paths";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  inactive: "This account is not active. Please contact support if you think this is a mistake.",
  invalid_link: "That link is invalid or has expired. Please try again.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : undefined;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;

  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(rawNext, user.role === "admin" ? "/admin" : "/dashboard"));

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to continue your preparation."
      footer={<>New here? <Link href={`/register?next=${encodeURIComponent(safeNextPath(rawNext))}`} className="font-medium text-[var(--color-ink)] underline underline-offset-4 decoration-[var(--color-accent)]">Create an account</Link></>}
    >
      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {/* Validated again on the server before use; passed through only if it is a safe local path. */}
      <LoginForm next={rawNext && safeNextPath(rawNext, "") ? rawNext : undefined} />
    </AuthCard>
  );
}
