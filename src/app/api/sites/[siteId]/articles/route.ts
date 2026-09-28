import { NextRequest } from "next/server";
import { handleApi, readJson, requireApiUser, enforceRateLimit } from "@/lib/api/http";
import { articleFilterSchema, articleWriteSchema, createArticle, listArticles } from "@/lib/services/articles";

type Params = { params: Promise<{ siteId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const url = new URL(req.url);
    const takeParam = url.searchParams.get("take");
    const filter = articleFilterSchema.parse({
      siteId,
      status: url.searchParams.get("status") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      take: takeParam && Number.isFinite(Number(takeParam)) ? Number(takeParam) : undefined,
    });
    return listArticles(user.id, filter);
  });
}

const createSchema = articleWriteSchema.extend({});

export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    enforceRateLimit(req, `create-article:${user.id}`, 30, 60_000);
    const data = createSchema.parse(await readJson(req));
    return createArticle({ siteId, userId: user.id, data });
  });
}
