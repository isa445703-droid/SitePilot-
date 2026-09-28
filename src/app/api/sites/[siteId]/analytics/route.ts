import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, requireApiUser } from "@/lib/api/http";
import { getOwnedSite } from "@/lib/auth/guards";
import { getSiteAnalytics } from "@/lib/analytics";

type Params = { params: Promise<{ siteId: string }> };

/** GET /api/sites/:siteId/analytics?days=30 */
export async function GET(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    const days = z
      .enum(["7", "30", "90"])
      .catch("30")
      .parse(new URL(req.url).searchParams.get("days") ?? "30");

    const report = await getSiteAnalytics(siteId, Number(days));
    return { ...report, site: { id: site.id, name: site.name } };
  });
}
