import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { accessibleSiteIds } from "@/lib/services/activity";
import { ContentExplorer, type ArticleRow } from "@/components/content/content-explorer";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage() {
  const user = await requireUser();
  const { t } = await getServerI18n();

  const siteIds = await accessibleSiteIds(user.id);
  const [articles, sites] = await Promise.all([
    siteIds.length
      ? db.article.findMany({
          where: { siteId: { in: siteIds }, status: { not: "ARCHIVED" } },
          orderBy: { updatedAt: "desc" },
          take: 150,
          include: {
            site: { select: { id: true, name: true, language: true } },
            category: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    siteIds.length
      ? db.site.findMany({
          where: { id: { in: siteIds }, status: { not: "ARCHIVED" } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

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
      sites={sites}
      title={t("content.title")}
      subtitle={t("content.subtitle")}
    />
  );
}
