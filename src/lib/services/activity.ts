import "server-only";
import { db } from "@/lib/db/prisma";
import { getOwnedSite } from "@/lib/auth/guards";

export type ActivityFilter = {
  siteId?: string;
  agent?: string;
  status?: "SUCCESS" | "FAILED";
  take?: number;
};

/** Reads the AI activity log for the sites the user may access. */
export async function listRuns(userId: string, filter: ActivityFilter = {}) {
  const siteIds = await accessibleSiteIds(userId, filter.siteId);
  if (siteIds.length === 0) return [];

  return db.agentRun.findMany({
    where: {
      siteId: { in: siteIds },
      ...(filter.agent ? { agent: filter.agent } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filter.take ?? 50,
    include: {
      site: { select: { id: true, name: true } },
      task: { select: { id: true, type: true, status: true } },
    },
  });
}

export async function listTasks(
  userId: string,
  filter: { siteId?: string; status?: string; take?: number } = {},
) {
  const siteIds = await accessibleSiteIds(userId, filter.siteId);
  if (siteIds.length === 0) return [];

  return db.agentTask.findMany({
    where: {
      siteId: { in: siteIds },
      ...(filter.status ? { status: filter.status as never } : {}),
    },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
    take: filter.take ?? 50,
    include: { site: { select: { id: true, name: true } } },
  });
}

export async function accessibleSiteIds(userId: string, siteId?: string): Promise<string[]> {
  const memberships = await db.orgMember.findMany({ where: { userId } });
  if (memberships.length === 0) return [];

  const sites = await db.site.findMany({
    where: {
      organizationId: { in: memberships.map((m) => m.organizationId) },
      ...(siteId ? { id: siteId } : {}),
    },
    select: { id: true },
  });
  return sites.map((s) => s.id);
}

export async function getActivitySummary(userId: string, siteId?: string) {
  if (siteId) {
    const site = await getOwnedSite(siteId, userId);
    if (!site) return null;
  }

  const siteIds = await accessibleSiteIds(userId, siteId);
  if (siteIds.length === 0) {
    return { runs: 0, failed: 0, queued: 0, completed: 0, tokens: 0, lastRun: null };
  }

  const [runs, failed, queued, completed, tokenAgg, lastRun] = await Promise.all([
    db.agentRun.count({ where: { siteId: { in: siteIds } } }),
    db.agentRun.count({ where: { siteId: { in: siteIds }, status: "FAILED" } }),
    db.agentTask.count({ where: { siteId: { in: siteIds }, status: { in: ["QUEUED", "RUNNING"] } } }),
    db.agentTask.count({ where: { siteId: { in: siteIds }, status: "COMPLETED" } }),
    db.usageEvent.aggregate({
      where: { siteId: { in: siteIds } },
      _sum: { promptTokens: true, outputTokens: true },
    }),
    db.agentRun.findFirst({
      where: { siteId: { in: siteIds } },
      orderBy: { createdAt: "desc" },
      include: { site: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    runs,
    failed,
    queued,
    completed,
    tokens: (tokenAgg._sum.promptTokens ?? 0) + (tokenAgg._sum.outputTokens ?? 0),
    lastRun,
  };
}

/** Per-site usage totals (cost control). */
export async function getUsageBySite(userId: string, days = 30) {
  const siteIds = await accessibleSiteIds(userId);
  if (siteIds.length === 0) return [];
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await db.usageEvent.groupBy({
    by: ["siteId", "model"],
    where: { siteId: { in: siteIds }, createdAt: { gte: since } },
    _sum: { promptTokens: true, outputTokens: true },
    _count: { _all: true },
  });

  return rows.map((row) => ({
    siteId: row.siteId,
    model: row.model,
    calls: row._count._all,
    promptTokens: row._sum.promptTokens ?? 0,
    outputTokens: row._sum.outputTokens ?? 0,
  }));
}
