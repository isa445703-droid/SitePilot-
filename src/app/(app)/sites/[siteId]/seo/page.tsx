import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { siteHref } from "@/lib/site-url";
import { PageHeader } from "@/components/ui/card";
import { SeoPanel, type SeoIssueRow } from "@/components/seo/seo-panel";

export const metadata: Metadata = { title: "SEO" };

type Params = { params: Promise<{ siteId: string }> };

export default async function SeoPage({ params }: Params) {
  const user = await requireUser();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, user.id);
  if (!site) notFound();

  const { t } = await getServerI18n();

  const [issues, settings] = await Promise.all([
    db.seoIssue.findMany({
      where: { siteId: site.id, resolved: false },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: { article: { select: { id: true, title: true } } },
    }),
    db.siteSettings.findUnique({ where: { siteId: site.id } }),
  ]);

  const rows: SeoIssueRow[] = issues.map((issue) => ({
    id: issue.id,
    type: issue.type,
    severity: issue.severity,
    message: issue.message,
    article: issue.article ? { id: issue.article.id, title: issue.article.title } : null,
  }));

  return (
    <>
      <PageHeader title={t("seo.title")} description={t("seo.subtitle")} />
      <SeoPanel
        siteId={site.id}
        initialIssues={rows}
        siteTitle={settings?.siteTitle || site.name}
        metaDescription={settings?.metaDescription || site.description}
        indexable={settings?.indexable ?? true}
        robotsPath={`/preview/${site.id}/robots.txt`}
        sitemapPath={siteHref(site.slug, "/sitemap.xml")}
      />
    </>
  );
}
