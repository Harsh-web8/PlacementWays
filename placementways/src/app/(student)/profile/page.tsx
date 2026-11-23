import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-4xl tracking-tight">Your profile</h1>
      <p className="mt-2 mb-8 text-[var(--color-ink)]/70">We only ask for what helps personalise your practice.</p>
      <ProfileForm
        email={user.email}
        initial={{
          name: user.name,
          college: user.college ?? "",
          degree: user.degree ?? "",
          graduationYear: user.graduationYear?.toString() ?? "",
        }}
      />
    </div>
  );
}
