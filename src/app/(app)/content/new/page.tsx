import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { accessibleSiteIds } from "@/lib/services/activity";
import { ArticleEditor } from "@/components/editor/article-editor";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const user = await requireUser();
  const { site } = await searchParams;
  const { t } = await getServerI18n();

  const siteIds = await accessibleSiteIds(user.id);
  const target = site && siteIds.includes(site) ? site : siteIds[0];
  if (!target) redirect("/sites");

  const targetSite = await db.site.findUnique({
    where: { id: target },
    select: { id: true, name: true, language: true },
  });
  if (!targetSite) redirect("/sites");

  const categories = await db.category.findMany({
    where: { siteId: targetSite.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <h1 className="sr-only">{t("content.newArticle")}</h1>
      <ArticleEditor
        article={null}
        isNew
        siteId={targetSite.id}
        categories={categories}
        siteLanguage={targetSite.language}
        siteName={targetSite.name}
      />
    </div>
  );
}
