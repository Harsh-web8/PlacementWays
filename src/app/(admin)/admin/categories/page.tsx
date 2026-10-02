import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { listAdminCategories } from "@/server/admin/categories/queries";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { deleteCategory } from "@/server/admin/categories/actions";
import type { AdminCategory } from "@/server/admin/categories/queries";

export const metadata = { title: "Categories" };

function groupByParent(categories: AdminCategory[]) {
  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);
  return { topLevel, childrenOf };
}

export default async function AdminCategoriesPage() {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const categories = await listAdminCategories();
  const { topLevel, childrenOf } = groupByParent(categories);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Categories</h1>
          <p className="mt-2 text-[var(--color-ink)]/70">
            {categories.length} categories across {topLevel.length} top-level groups.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/categories/new">Add category</Link>
        </Button>
      </div>

      {topLevel.length === 0 ? (
        <p className="text-[var(--color-ink)]/70">No categories yet.</p>
      ) : (
        <div className="space-y-6">
          {topLevel.map((parent) => (
            <div key={parent.id} className="rounded-sm border border-[var(--color-line)]">
              <CategoryRow category={parent} />
              {childrenOf(parent.id).length > 0 && (
                <ul className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                  {childrenOf(parent.id).map((child) => (
                    <li key={child.id} className="pl-6">
                      <CategoryRow category={child} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ category }: { category: AdminCategory }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{category.name}</p>
        <p className="text-xs text-[var(--color-ink)]/60">/{category.slug}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <Link href={`/admin/categories/${category.id}`} className="text-sm underline underline-offset-4 hover:no-underline">
          Edit
        </Link>
        <ActionButton
          action={deleteCategory.bind(null, category.id)}
          variant="ghost"
          size="sm"
          className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
          confirmMessage={`Delete "${category.name}"? This only works if it has no questions or subcategories.`}
        >
          Delete
        </ActionButton>
      </div>
    </div>
  );
}
