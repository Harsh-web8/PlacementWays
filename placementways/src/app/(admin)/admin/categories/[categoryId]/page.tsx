import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { getAdminCategory, listAdminCategories } from "@/server/admin/categories/queries";
import { updateCategory } from "@/server/admin/categories/actions";
import { CategoryForm } from "@/components/admin/category-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({ params }: PageProps<"/admin/categories/[categoryId]">) {
  const { categoryId } = await params;
  const category = await getAdminCategory(categoryId);
  return { title: category ? category.name : "Category" };
}

export default async function EditCategoryPage({ params }: PageProps<"/admin/categories/[categoryId]">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const { categoryId } = await params;

  const [category, categories] = await Promise.all([getAdminCategory(categoryId), listAdminCategories()]);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">{category.name}</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">/{category.slug}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Category details</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            category={category}
            parentOptions={categories.some((c) => c.parent_id === category.id) ? [] : categories.filter((c) => c.id !== category.id && c.parent_id === null)}
            action={updateCategory.bind(null, category.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
