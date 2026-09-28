import { NextRequest } from "next/server";
import { handleApi, requireApiUser, enforceRateLimit } from "@/lib/api/http";
import { runArticleAiAction } from "@/lib/services/articles";

type Params = { params: Promise<{ articleId: string }> };

/** POST /api/articles/:articleId/seo — metadata optimization pass. */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { articleId } = await params;
    enforceRateLimit(req, `seo:${user.id}`, 12, 60_000);
    return runArticleAiAction({ articleId, userId: user.id, action: "seo" });
  });
}
