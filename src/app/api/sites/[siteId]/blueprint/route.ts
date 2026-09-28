import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, enforceRateLimit, readJson, requireApiUser } from "@/lib/api/http";
import { generateSiteBlueprint, saveBlueprint } from "@/lib/services/sites";
import { getOwnedSite } from "@/lib/auth/guards";

type Params = { params: Promise<{ siteId: string }> };

const generateSchema = z.object({
  brief: z.string().trim().min(20).max(4000).optional(),
  siteName: z.string().trim().max(120).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().max(64).optional(),
  designBrief: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/sites/:siteId/blueprint
 * Generates a blueprint (review step) or re-runs it after an edit.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    enforceRateLimit(req, `blueprint:${user.id}`, 6, 60_000);

    const input = generateSchema.parse(await readJson(req));
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    return generateSiteBlueprint({
      siteId,
      userId: user.id,
      brief: input.brief || site.brief,
      siteName: input.siteName,
      language: input.language || site.language,
      timezone: input.timezone || site.timezone,
      designBrief: input.designBrief ?? site.designBrief,
    });
  });
}

const saveSchema = z.object({ blueprint: z.unknown() });

/** PUT /api/sites/:siteId/blueprint — store a user-edited blueprint. */
export async function PUT(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const body = saveSchema.parse(await readJson(req));
    return saveBlueprint({ siteId, userId: user.id, blueprint: body.blueprint });
  });
}
