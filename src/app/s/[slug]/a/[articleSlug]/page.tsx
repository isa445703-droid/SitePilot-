import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { ArticleView, articleMetadata } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; articleSlug: string }> };

function findArticle(slug: string, articleSlug: string) {
  return db.article.findFirst({
    where: { slug: articleSlug, status: "PUBLISHED", site: { slug, status: { not: "ARCHIVED" } } },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      site: { select: { settings: { select: { indexable: true } } } },
    },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: rawSlug, articleSlug: rawArticle } = await params;
  const slug = decodeRouteParam(rawSlug);
  const articleSlug = decodeRouteParam(rawArticle);
  const article = await findArticle(slug, articleSlug);
  return articleMetadata(article, {
    canonicalUrl: `/s/${slug}/a/${articleSlug}`,
    indexable: article?.site.settings?.indexable,
  });
}

/** Article route scoped to its site (served on the site subdomain). */
export default async function PublicSiteArticle({ params }: Params) {
  const { slug: rawSlug, articleSlug: rawArticle } = await params;
  const slug = decodeRouteParam(rawSlug);
  const articleSlug = decodeRouteParam(rawArticle);
  const article = await findArticle(slug, articleSlug);
  if (!article) notFound();
  return <ArticleView article={article} basePath={`/s/${slug}`} />;
}
