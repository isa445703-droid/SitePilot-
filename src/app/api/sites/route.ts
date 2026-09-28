import { NextRequest } from "next/server";
import { db } from "@/lib/db/prisma";
import { handleApi, requireApiUser, enforceRateLimit } from "@/lib/api/http";
import { createSiteForUser, createSiteSchema } from "@/lib/services/sites";
import { accessibleSiteIds } from "@/lib/services/activity";
import { readJson } from "@/lib/api/http";

/** GET /api/sites — list the caller's sites. */
export async function GET() {
  return handleApi(async () => {
    const user = await requireApiUser();
    const siteIds = await accessibleSiteIds(user.id);
    if (siteIds.length === 0) return [];
    return db.site.findMany({
      where: { id: { in: siteIds } },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { articles: true, tasks: true } },
        schedule: { select: { enabled: true, nextRunAt: true, frequency: true } },
      },
    });
  });
}

/** POST /api/sites — create a site from a natural-language brief. */
export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireApiUser();
    enforceRateLimit(req, `create-site:${user.id}`, 10, 60_000);

    const input = createSiteSchema.parse(await readJson(req));
    const memberships = await db.orgMember.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    const organizationId = memberships[0]?.organizationId;
    if (!organizationId) throw Object.assign(new Error("No workspace found."), { status: 400, code: "NO_WORKSPACE" });

    const site = await createSiteForUser({ userId: user.id, organizationId, input });
    return site;
  });
}
