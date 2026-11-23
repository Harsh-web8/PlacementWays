import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

type Status = Enums<"content_status">;

const STYLES: Record<Status, string> = {
  draft: "bg-[var(--color-ink)]/8 text-[var(--color-ink)]/70",
  published: "bg-[var(--color-success)]/12 text-[var(--color-success)]",
  archived: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
};

const LABELS: Record<Status, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", STYLES[status], className)}>
      {LABELS[status]}
    </span>
  );
}
