"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { companySchema } from "@/lib/validation/company";
import { requireAdmin } from "@/server/auth/session";
import { logAdminAction } from "@/server/admin/audit";
import type { Enums } from "@/types/database";

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors;

type CompanyStatus = Enums<"content_status">;
const COMPANY_STATUSES: readonly CompanyStatus[] = ["draft", "published", "archived"];

function readCompanyForm(formData: FormData) {
  return {
    name: field(formData, "name"),
    slug: field(formData, "slug"),
    description: field(formData, "description"),
    logoUrl: field(formData, "logoUrl"),
    websiteUrl: field(formData, "websiteUrl"),
    seoTitle: field(formData, "seoTitle"),
    seoDescription: field(formData, "seoDescription"),
    sortOrder: field(formData, "sortOrder"),
  };
}

/** Public pages read companies/processes directly, so any admin write needs to bust that cache too. */
function revalidatePublicContent() {
  revalidatePath("/", "layout");
}

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readCompanyForm(formData);
  const parsed = companySchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      logo_url: parsed.data.logoUrl,
      website_url: parsed.data.websiteUrl,
      seo_title: parsed.data.seoTitle,
      seo_description: parsed.data.seoDescription,
      sort_order: parsed.data.sortOrder,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { status: "error", message: "A company with that name or slug already exists.", values: raw };
    }
    console.error("[admin] could not create company", { code: error?.code });
    return { status: "error", message: "We couldn't create the company. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "company.create", "company", data.id, { name: parsed.data.name });
  revalidatePath("/admin/companies");
  revalidatePublicContent();
  redirect(`/admin/companies/${data.id}`);
}

export async function updateCompany(companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readCompanyForm(formData);
  const parsed = companySchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      logo_url: parsed.data.logoUrl,
      website_url: parsed.data.websiteUrl,
      seo_title: parsed.data.seoTitle,
      seo_description: parsed.data.seoDescription,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error?.code === "23505") {
      return { status: "error", message: "A company with that name or slug already exists.", values: raw };
    }
    console.error("[admin] could not update company", { code: error?.code });
    return { status: "error", message: "We couldn't save the company. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "company.update", "company", companyId, { name: parsed.data.name });
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePublicContent();
  return { status: "success", message: "Company saved.", values: raw };
}

/**
 * Bound as `setCompanyStatus.bind(null, companyId, status)` and driven by
 * useActionState (see ActionButton), so it takes the same trailing
 * (prevState, formData) shape as every other Server Action here even though
 * this one has no actual form fields.
 */
export async function setCompanyStatus(companyId: string, status: CompanyStatus, _prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!COMPANY_STATUSES.includes(status)) return { status: "error", message: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("companies").update({ status }).eq("id", companyId);
  if (error) {
    console.error("[admin] could not update company status", { code: error.code });
    return { status: "error", message: "We couldn't update the company's status. Please try again." };
  }

  await logAdminAction(supabase, admin.id, `company.${status}`, "company", companyId);
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePublicContent();
  return { status: "success" };
}
