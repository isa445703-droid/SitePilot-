import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, readJson, requireApiUser, enforceRateLimit } from "@/lib/api/http";
import { regenerateArticleContent } from "@/lib/services/articles";

type Params = { params: Promise<{ articleId: string }> };

const schema = z.object({
  title: z.string().trim().max(200).optional(),
  instruction: z.string().max(1000).optional(),
});

/** POST /api/articles/:articleId/generate — write (or rewrite) the body. */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { articleId } = await params;
    enforceRateLimit(req, `generate:${user.id}`, 12, 60_000);
    const input = schema.parse(await readJson(req));
    return regenerateArticleContent({ articleId, userId: user.id, ...input });
  });
}
