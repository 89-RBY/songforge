import type { PrismaClient } from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminMetrics = {
  songs30: number;
  ready30: number;
  failed30: number;
  activeUsers30: number;
  totalUsers: number;
  blockedUsers: number;
  revenueCents30: number;
  creditsSold30: number;
  apiCostCents30: number;
  creditsSpent30: number;
  apiSpendTodayCents: number;
  errors7: { code: string; count: number }[];
};

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Figures for the admin overview. Revenue and cost are estimates: they exclude VAT and payment fees,
// and the API cost counts completed songs only.
export async function getAdminMetrics(db: PrismaClient, now: Date = new Date()): Promise<AdminMetrics> {
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);

  const [
    songs30,
    ready30,
    failed30,
    activeGroups,
    totalUsers,
    blockedUsers,
    sales,
    apiCost,
    spent,
    today,
    errorGroups,
  ] = await Promise.all([
    db.song.count({ where: { createdAt: { gte: since30 } } }),
    db.song.count({ where: { createdAt: { gte: since30 }, status: "READY" } }),
    db.song.count({ where: { createdAt: { gte: since30 }, status: "FAILED" } }),
    db.song.groupBy({ by: ["userId"], where: { createdAt: { gte: since30 } } }),
    db.user.count(),
    db.user.count({ where: { blocked: true } }),
    db.creditEntry.aggregate({
      where: { reason: "PURCHASE", createdAt: { gte: since30 } },
      _sum: { priceCents: true, amount: true },
    }),
    db.song.aggregate({
      where: { status: "READY", completedAt: { gte: since30 } },
      _sum: { apiCostCents: true },
    }),
    db.creditEntry.aggregate({
      where: { reason: "GENERATION", createdAt: { gte: since30 } },
      _sum: { amount: true },
    }),
    // Every song queued today counts, whatever its status: the daily cap is checked against the same figure.
    db.song.aggregate({
      where: { createdAt: { gte: startOfUtcDay(now) } },
      _sum: { apiCostCents: true },
    }),
    db.song.groupBy({
      by: ["errorCode"],
      where: { status: "FAILED", updatedAt: { gte: since7 } },
      _count: { _all: true },
      orderBy: { _count: { errorCode: "desc" } },
    }),
  ]);

  return {
    songs30,
    ready30,
    failed30,
    activeUsers30: activeGroups.length,
    totalUsers,
    blockedUsers,
    revenueCents30: sales._sum.priceCents ?? 0,
    creditsSold30: sales._sum.amount ?? 0,
    apiCostCents30: apiCost._sum.apiCostCents ?? 0,
    creditsSpent30: -(spent._sum.amount ?? 0),
    apiSpendTodayCents: today._sum.apiCostCents ?? 0,
    errors7: errorGroups.map((group) => ({ code: group.errorCode ?? "UNKNOWN", count: group._count._all })),
  };
}
