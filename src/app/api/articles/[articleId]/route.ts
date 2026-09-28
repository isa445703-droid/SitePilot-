import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, readJson, requireApiUser } from "@/lib/api/http";
import { getOwnedArticle } from "@/lib/auth/guards";
import {
  archiveArticle,
  publishArticle,
  updateArticle,
  articleWriteSchema,
} from "@/lib/services/articles";

type Params = { params: Promise<{ articleId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { articleId } = await params;
    const article = await getOwnedArticle(articleId, user.id);
    if (!article) throw Object.assign(new Error("Article not found"), { status: 404, code: "NOT_FOUND" });
    return article;
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { articleId } = await params;
    const data = articleWriteSchema.partial().parse(await readJson(req));
    return updateArticle({ articleId, userId: user.id, data });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { articleId } = await params;
    return archiveArticle({ articleId, userId: user.id });
  });
}

const actionSchema = z.object({
  action: z.enum(["publish", "unpublish", "approve"]),
});

/** POST /api/articles/:articleId — publish / approve / unpublish. */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { articleId } = await params;
    const { action } = actionSchema.parse(await readJson(req));
    return publishArticle({ articleId, userId: user.id, action });
  });
}
