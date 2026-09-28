import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, readJson, requireApiUser, enforceRateLimit } from "@/lib/api/http";
import { generateArticleTask } from "@/lib/services/articles";
import { throwAgentFailure } from "@/lib/agents/run";

type Params = { params: Promise<{ siteId: string }> };

const schema = z.object({
  title: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  instruction: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/sites/:siteId/articles/generate
 * Runs the full research → write → edit → SEO pipeline for one new article.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    enforceRateLimit(req, `generate-article:${user.id}`, 6, 60_000);

    const input = schema.parse(await readJson(req));
    const result = await generateArticleTask({ siteId, userId: user.id, ...input });

    if (!result.outcome.ok) throwAgentFailure(result.outcome);
    const output = (result.outcome.output ?? {}) as { articleId?: string; isDemo?: boolean };
    return {
      taskId: result.task.id,
      articleId: output.articleId ?? null,
      isDemo: output.isDemo ?? false,
    };
  });
}
