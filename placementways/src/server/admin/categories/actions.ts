"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { categorySchema } from "@/lib/validation/category";
import { requireAdmin } from "@/server/auth/session";
import { logAdminAction } from "@/server/admin/audit";

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors;

function readCategoryForm(formData: FormData) {
  return {
    name: field(formData, "name"),
    slug: field(formData, "slug"),
    description: field(formData, "description"),
    parentId: field(formData, "parentId"),
    sortOrder: field(formData, "sortOrder"),
  };
}

/** The UI supports subjects with one level of topics, never a deeper tree. */
async function validateParent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  categoryId?: string,
): Promise<string | null> {
  if (!parentId) return null;
  if (parentId === categoryId) return "A category can't be its own parent.";
  const { data: parent, error } = await supabase.from("categories")
    .select("id, parent_id").eq("id", parentId).maybeSingle();
  if (error) return "We couldn't verify the parent. Please try again.";
  if (!parent || parent.parent_id !== null) return "Choose an existing top-level parent category.";
  if (categoryId) {
    const { data: children, error: childrenError } = await supabase.from("categories")
      .select("id").eq("parent_id", categoryId).limit(1);
    if (childrenError) return "We couldn't verify this category's children. Please try again.";
    if (children?.length) return "A category with subcategories must remain top-level.";
  }
  return null;
}

export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readCategoryForm(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const parentError = await validateParent(supabase, parsed.data.parentId);
  if (parentError) return { status: "error", fieldErrors: { parentId: [parentError] }, values: raw };
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      parent_id: parsed.data.parentId || null,
      sort_order: parsed.data.sortOrder,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { status: "error", message: "A category with that slug already exists.", values: raw };
    }
    console.error("[admin] could not create category", { code: error?.code });
    return { status: "error", message: "We couldn't create the category. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "category.create", "category", data.id, { name: parsed.data.name });
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategory(categoryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = readCategoryForm(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }
  if (parsed.data.parentId === categoryId) {
    return { status: "error", fieldErrors: { parentId: ["A category can't be its own parent."] }, values: raw };
  }

  const supabase = await createClient();
  const parentError = await validateParent(supabase, parsed.data.parentId, categoryId);
  if (parentError) return { status: "error", fieldErrors: { parentId: [parentError] }, values: raw };
  const { data, error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      parent_id: parsed.data.parentId || null,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", categoryId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error?.code === "23505") {
      return { status: "error", message: "A category with that slug already exists.", values: raw };
    }
    if (error?.code === "23514") {
      return { status: "error", fieldErrors: { parentId: ["A category can't be its own parent."] }, values: raw };
    }
    console.error("[admin] could not update category", { code: error?.code });
    return { status: "error", message: "We couldn't save the category. Please try again.", values: raw };
  }

  await logAdminAction(supabase, admin.id, "category.update", "category", categoryId, { name: parsed.data.name });
  revalidatePath("/admin/categories");
  return { status: "success", message: "Category saved.", values: raw };
}

export async function deleteCategory(categoryId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) {
    if (error.code === "23503") {
      return {
        status: "error",
        message: "This category can't be deleted -- it still has questions or subcategories. Move or remove those first.",
      };
    }
    console.error("[admin] could not delete category", { code: error.code });
    return { status: "error", message: "We couldn't delete this category. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "category.delete", "category", categoryId);
  revalidatePath("/admin/categories");
  return { status: "success" };
}
