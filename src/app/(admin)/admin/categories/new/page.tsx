import { requireAdmin } from "@/server/auth/session";
import { listAdminCategories } from "@/server/admin/categories/queries";
import { createCategory } from "@/server/admin/categories/actions";
import { CategoryForm } from "@/components/admin/category-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Add a category" };

export default async function NewCategoryPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const categories = await listAdminCategories();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Add a category</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">Used to organise questions across the aptitude, reasoning, verbal, programming and CS question bank.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Category details</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm parentOptions={categories.filter((c) => c.parent_id === null)} action={createCategory} />
        </CardContent>
      </Card>
    </div>
  );
}
