import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { ArticleView, articleMetadata } from "@/components/preview/public-views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; articleSlug: string }> };

function findArticle(slug: string, articleSlug: string) {
  return db.article.findFirst({
    where: { slug: articleSlug, status: "PUBLISHED", site: { slug, status: { not: "ARCHIVED" } } },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, articleSlug } = await params;
  return articleMetadata(await findArticle(slug, articleSlug));
}

/** Article route scoped to its site (served on the site subdomain). */
export default async function PublicSiteArticle({ params }: Params) {
  const { slug, articleSlug } = await params;
  const article = await findArticle(slug, articleSlug);
  if (!article) notFound();
  return <ArticleView article={article} />;
}
