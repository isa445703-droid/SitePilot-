import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { ArticleView, articleMetadata } from "@/components/preview/public-views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

function findArticle(slug: string) {
  return db.article.findFirst({
    where: { slug, status: "PUBLISHED", site: { status: { not: "ARCHIVED" } } },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return articleMetadata(await findArticle(slug));
}

/**
 * Legacy public article route (global slug lookup). The canonical address of
 * an article is `<site-subdomain>/a/<slug>`; this route stays as a fallback
 * for old links.
 */
export default async function PublicArticle({ params }: Params) {
  const { slug } = await params;
  const article = await findArticle(slug);
  if (!article) notFound();
  return <ArticleView article={article} />;
}
