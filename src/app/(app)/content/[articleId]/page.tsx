import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getOwnedArticle } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { ArticleEditor, type EditorArticle } from "@/components/editor/article-editor";

export const metadata: Metadata = { title: "Editor" };

type Params = { params: Promise<{ articleId: string }> };

export default async function ArticlePage({ params }: Params) {
  const user = await requireUser();
  const { articleId } = await params;
  const article = await getOwnedArticle(articleId, user.id);
  if (!article) notFound();

  const categories = await db.category.findMany({
    where: { siteId: article.siteId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const view: EditorArticle = {
    id: article.id,
    siteId: article.siteId,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    content: article.content ?? "",
    status: article.status,
    seoTitle: article.seoTitle ?? "",
    seoDescription: article.seoDescription ?? "",
    tags: (article.tags ?? []) as string[],
    categoryId: article.categoryId,
    language: article.language,
    author: article.author ?? "",
    wordCount: article.wordCount,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    updatedAt: article.updatedAt.toISOString(),
  };

  return (
    <ArticleEditor
      article={view}
      siteId={article.siteId}
      categories={categories}
      siteLanguage={article.site.language}
      siteName={article.site.name}
    />
  );
}
