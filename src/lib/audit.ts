import { db } from "@/src/db/client";
import { auditLog } from "@/src/db/schema";
import { newId } from "@/src/lib/id";

// Append-only audit logging (DATA-MODEL §14). Never throws into the caller's
// happy path — auditing failures must not break the action being audited.
export interface AuditEntry {
  actorId?: string | null;
  actorType?: "user" | "client" | "system";
  action: string;
  entityType: string;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: newId(),
      actorId: entry.actorId ?? null,
      actorType: entry.actorType ?? "user",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      ipAddress: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write entry", entry.action, err);
  }
}
