import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof prisma;

export interface AuditInput {
  userId?: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

/** Append-only audit log write. Pass a tx client to include it in a transaction. */
export async function writeAudit(client: Tx, input: AuditInput): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue === undefined ? undefined : (input.oldValue as Prisma.InputJsonValue),
      newValue: input.newValue === undefined ? undefined : (input.newValue as Prisma.InputJsonValue),
      reason: input.reason,
    },
  });
}