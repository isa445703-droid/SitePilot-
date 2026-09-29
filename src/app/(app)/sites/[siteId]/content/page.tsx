import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { ContentExplorer, type ArticleRow } from "@/components/content/content-explorer";

export const metadata: Metadata = { title: "Content" };

type Params = { params: Promise<{ siteId: string }> };

export default async function SiteContentPage({ params }: Params) {
  const user = await requireUser();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, user.id);
  const { t } = await getServerI18n();
  if (!site) notFound();

  const articles = await db.article.findMany({
    where: { siteId: site.id, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      site: { select: { id: true, name: true, language: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const rows = articles.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    status: article.status,
    updatedAt: article.updatedAt.toISOString(),
    wordCount: article.wordCount,
    excerpt: article.excerpt ?? "",
    site: article.site,
    category: article.category,
  })) as ArticleRow[];

  return (
    <ContentExplorer
      articles={rows}
      siteId={site.id}
      title={t("content.title")}
      subtitle={site.name}
    />
  );
}
