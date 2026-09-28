import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, readJson, requireApiUser } from "@/lib/api/http";
import { deleteSite, getSiteOverview, updateSite, updateSiteSchema } from "@/lib/services/sites";
import { getOwnedSite } from "@/lib/auth/guards";

type Params = { params: Promise<{ siteId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const overview = await getSiteOverview(siteId, user.id, user.locale as never);
    if (!overview) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });
    return overview;
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const data = updateSiteSchema.parse(await readJson(req));
    const site = await updateSite({ siteId, userId: user.id, data });
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });
    return site;
  });
}

const deleteSchema = z.object({ confirm: z.literal(true) });

/** DELETE /api/sites/:siteId — permanently delete a site (user action, never an agent action). */
export async function DELETE(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    deleteSchema.parse(await readJson(req));
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });
    return deleteSite({ siteId, userId: user.id });
  });
}
