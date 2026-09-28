import { NextRequest } from "next/server";
import { handleApi, requireApiUser } from "@/lib/api/http";
import { listRuns, getActivitySummary } from "@/lib/services/activity";

type Params = { params: Promise<{ siteId: string }> };

/** GET /api/sites/:siteId/activity — the AI activity log for one site. */
export async function GET(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const url = new URL(req.url);

    const [runs, summary] = await Promise.all([
      listRuns(user.id, {
        siteId,
        agent: url.searchParams.get("agent") ?? undefined,
        status: (url.searchParams.get("status") as "SUCCESS" | "FAILED" | null) ?? undefined,
        take: 100,
      }),
      getActivitySummary(user.id, siteId),
    ]);

    if (runs.length === 0 && !summary) {
      throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });
    }

    return { runs, summary };
  });
}
