import { NextRequest } from "next/server";
import { handleApi, requireApiUser } from "@/lib/api/http";
import { provisionSite } from "@/lib/services/sites";
import { runDueTasks, ensureSchedules } from "@/lib/scheduler";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ siteId: string }> };

/**
 * POST /api/sites/:siteId/generate
 * Approves the blueprint, builds categories/pages/design and kicks off the
 * first content tasks. Returns once the structural work is done so the UI can
 * show real progress while tasks continue in the background.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const body = (await req.json().catch(() => ({}))) as { timezone?: string };

    const result = await provisionSite({
      siteId,
      userId: user.id,
      timezone: body.timezone,
    });

    // Run the queued plan task right away (bounded) so the UI can show articles
    // appearing; remaining tasks continue through the scheduler loop.
    const tick = await runDueTasks(4);
    await ensureSchedules();

    logger.info("site_generated", { siteId, userId: user.id, ...tick });

    return { ...result, tick };
  });
}
