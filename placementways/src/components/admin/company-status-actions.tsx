import { ActionButton } from "@/components/admin/action-button";
import { setCompanyStatus } from "@/server/admin/companies/actions";
import type { AdminCompany } from "@/server/admin/companies/queries";

const DANGER_OUTLINE = "border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5";

export function CompanyStatusActions({ company }: { company: AdminCompany }) {
  if (company.status === "archived") {
    return (
      <ActionButton action={setCompanyStatus.bind(null, company.id, "draft")} variant="outline">
        Restore to draft
      </ActionButton>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {company.status === "draft" ? (
        <ActionButton action={setCompanyStatus.bind(null, company.id, "published")} variant="accent">
          Publish
        </ActionButton>
      ) : (
        <ActionButton action={setCompanyStatus.bind(null, company.id, "draft")} variant="outline">
          Unpublish
        </ActionButton>
      )}
      <ActionButton
        action={setCompanyStatus.bind(null, company.id, "archived")}
        variant="outline"
        className={DANGER_OUTLINE}
        confirmMessage={`Archive ${company.name}? It will disappear from public pages until restored.`}
      >
        Archive
      </ActionButton>
    </div>
  );
}
