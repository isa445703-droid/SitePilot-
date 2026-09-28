import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { ArticleView, articleMetadata } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

async function findArticle(slug: string) {
  return db.article.findFirst({
    where: { slug, status: "PUBLISHED", site: { status: { not: "ARCHIVED" } } },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      site: { select: { slug: true, settings: { select: { indexable: true } } } },
    },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const article = await findArticle(slug);
  return articleMetadata(article, {
    canonicalUrl: article ? `/s/${article.site.slug}/a/${article.slug}` : undefined,
    indexable: article?.site.settings?.indexable,
  });
}

/**
 * Legacy public article route (global slug lookup). The canonical address of an
 * article is `/s/<site>/a/<slug>`; this route stays for old inbound links and
 * renders the owning site's article with site-scoped links plus a canonical tag.
 */
export default async function PublicArticle({ params }: Params) {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const article = await findArticle(slug);
  if (!article) notFound();
  return <ArticleView article={article} basePath={`/s/${article.site.slug}`} />;
}
