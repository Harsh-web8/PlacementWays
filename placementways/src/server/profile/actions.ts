"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { profileSchema } from "@/lib/validation/profile";
import { requireUser } from "@/server/auth/session";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  // Authorisation first: who is calling? (Server Actions are public endpoints.)
  const user = await requireUser();

  const raw = {
    name: field(formData, "name"),
    college: field(formData, "college"),
    degree: field(formData, "degree"),
    graduationYear: field(formData, "graduationYear"),
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors, values: raw };
  }

  // The id comes from the verified session, never from the form. The query
  // runs as the user, so Row Level Security + column grants apply on top:
  // only these four columns are writable by a student.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      name: parsed.data.name,
      college: parsed.data.college,
      degree: parsed.data.degree,
      graduation_year: parsed.data.graduationYear,
    })
    .eq("id", user.id)
    .select("id");

  if (error || !data || data.length === 0) {
    console.error("[profile] update failed", { code: error?.code });
    return { status: "error", message: "We couldn't save your profile. Please try again.", values: raw };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Profile saved.", values: raw };
}
