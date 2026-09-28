import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { handleApi, readJson, requireApiUser } from "@/lib/api/http";
import { getOwnedSite } from "@/lib/auth/guards";
import { runSeoAudit } from "@/lib/agents/seo";
import { throwAgentFailure } from "@/lib/agents/run";

type Params = { params: Promise<{ siteId: string }> };

/** GET /api/sites/:siteId/seo — open issues + metadata basics. */
export async function GET(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    const [issues, settings, articles] = await Promise.all([
      db.seoIssue.findMany({
        where: { siteId, resolved: false },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 100,
        include: { article: { select: { id: true, title: true, slug: true } } },
      }),
      db.siteSettings.findUnique({ where: { siteId } }),
      db.article.count({ where: { siteId, status: "PUBLISHED" } }),
    ]);

    return { issues, settings, publishedArticles: articles };
  });
}

const auditSchema = z.object({ fix: z.boolean().default(false) });

/** POST /api/sites/:siteId/seo — run the audit (optionally fixing issues). */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    const { fix } = auditSchema.parse(await readJson(req));
    const result = await runSeoAudit({ siteId, fix });
    if (!result.ok) throwAgentFailure(result);
    return { ...result.value, runId: result.runId };
  });
}
