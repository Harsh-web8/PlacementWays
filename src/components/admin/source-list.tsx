import { Trash2, ExternalLink } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { SourceAddForm } from "@/components/admin/source-add-form";
import { deleteSource } from "@/server/admin/processes/actions";
import type { AdminSource } from "@/server/admin/processes/queries";

export function SourceList({ sources, processId, companyId }: { sources: AdminSource[]; processId: string; companyId: string }) {
  return (
    <div className="space-y-4">
      {sources.length === 0 ? (
        <p className="text-sm text-[var(--color-ink)]/65">
          No sources yet. A process needs at least one source link before it can be published.
        </p>
      ) : (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li key={source.id} className="flex items-center justify-between gap-3 rounded-sm border border-[var(--color-line)] px-4 py-3">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex min-w-0 items-center gap-2 text-sm underline underline-offset-4 hover:no-underline"
              >
                <ExternalLink aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{source.label}</span>
              </a>
              <ActionButton
                action={deleteSource.bind(null, source.id, processId, companyId)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
                confirmMessage={`Remove the source "${source.label}"?`}
              >
                <Trash2 aria-hidden />
                <span className="sr-only">Delete source</span>
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
      <SourceAddForm key={sources.length} processId={processId} companyId={companyId} />
    </div>
  );
}
