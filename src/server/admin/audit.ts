import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * Records an admin action in `audit_logs`. The table is append-only (no
 * update/delete grants -- see migration 4), so this is a best-effort insert:
 * a logging failure must never block the admin's actual request, so errors
 * are logged to the server console and swallowed rather than thrown.
 */
export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, Json> = {},
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error) {
    console.error("[audit] failed to record admin action", { action, entityType, entityId, code: error.code });
  }
}
