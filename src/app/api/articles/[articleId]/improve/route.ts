import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, readJson, requireApiUser, enforceRateLimit } from "@/lib/api/http";
import { runArticleAiAction } from "@/lib/services/articles";

type Params = { params: Promise<{ articleId: string }> };

const schema = z.object({
  mode: z.enum(["improve", "rewrite"]).default("improve"),
  instruction: z.string().max(1000).optional(),
});

/** POST /api/articles/:articleId/improve — editor pass. */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { articleId } = await params;
    enforceRateLimit(req, `improve:${user.id}`, 12, 60_000);
    const input = schema.parse(await readJson(req));
    const result = await runArticleAiAction({
      articleId,
      userId: user.id,
      action: input.mode === "rewrite" ? "rewrite" : "improve",
      instruction: input.instruction,
    });
    return result;
  });
}
