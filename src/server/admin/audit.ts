import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

// Writes an audit row. Pass a transaction when the change is made in one, so the two commit together.
export async function recordAudit(
  db: PrismaClient | Tx,
  actorId: string | null,
  action: string,
  targetId: string | null,
  detail?: Prisma.InputJsonValue,
): Promise<void> {
  await db.auditLog.create({
    data: { actorId, action, targetId, detail: detail ?? undefined },
  });
}
