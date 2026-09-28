import { NextRequest } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handleApi, readJson, requireApiUser } from "@/lib/api/http";
import { disableAutopilot, enableAutopilot } from "@/lib/scheduler";
import { getOwnedSite } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ siteId: string }> };

const autopilotSchema = z.object({
  mode: z.enum(["MANUAL", "REVIEW", "FULL"]),
});

/**
 * POST /api/sites/:siteId/autopilot  { mode: "MANUAL" | "REVIEW" | "FULL" }
 * MANUAL disables the loop; REVIEW/FULL create the first queued task.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    enforceRateLimit(req, "autopilot", 20, 60_000);
    const user = await requireApiUser();
    const { siteId } = await params;
    const { mode } = autopilotSchema.parse(await readJson(req));

    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    const result =
      mode === "MANUAL" ? await disableAutopilot(siteId) : await enableAutopilot(siteId, mode);

    logger.info("autopilot_changed", { siteId, userId: user.id, mode });
    return result;
  });
}
