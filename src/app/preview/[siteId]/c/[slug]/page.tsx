import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { loadSitePreview } from "@/lib/preview/data";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/config";
import { SiteChrome } from "@/components/preview/site-chrome";
import { ArticleCard, Breadcrumbs, SectionHead } from "@/components/preview/site-parts";
import { decodeRouteParam } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Preview" };

type Params = { params: Promise<{ siteId: string; slug: string }> };

export default async function PreviewCategoryPage({ params }: Params) {
  const user = await requireUser();
  const { siteId, slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const owned = await getOwnedSite(siteId, user.id);
  if (!owned) notFound();

  const data = await loadSitePreview(siteId);
  if (!data) notFound();

  const { site, design, settings, categories } = data;
  const category = await db.category.findFirst({ where: { siteId: site.id, slug } });
  if (!category) notFound();

  const articles = await db.article.findMany({
    where: { siteId: site.id, categoryId: category.id, status: { not: "ARCHIVED" } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  const { t, locale } = await getServerI18n();
  const basePath = `/preview/${site.id}`;

  return (
    <SiteChrome
      siteName={settings?.siteTitle || site.name}
      siteSlug={site.slug}
      basePath={basePath}
      design={design}
      categories={categories}
      footerText={settings?.footerText || undefined}
      locale={locale}
      homeLabel={t("preview.home")}
      previewBar={
        <div className="border-b border-line bg-accent-soft px-3 py-1.5 text-center text-xs text-accent">
          {t("preview.previewNotice")}
        </div>
      }
    >
      <section className="pv-page-head">
        <Breadcrumbs basePath={basePath} homeLabel={t("preview.home")} current={category.name} />
        <h1>{category.name}</h1>
        {category.description ? <p className="pv-hero-sub">{category.description}</p> : null}
        <p className="pv-meta">
          {articles.length} · {t("preview.latestArticles").toLowerCase()}
        </p>
      </section>

      {articles.length === 0 ? (
        <p className="pv-empty">{t("preview.noArticles")}</p>
      ) : (
        <div className="pv-card-grid">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              href={`${basePath}/a/${article.slug}`}
              meta={formatDate(article.publishedAt ?? article.createdAt, locale)}
              status={article.status === "PUBLISHED" ? null : article.status}
            />
          ))}
        </div>
      )}

      {categories.length > 1 ? (
        <section className="pv-section">
          <SectionHead title={t("preview.categories")} />
          <div className="pv-chip-row">
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`${basePath}/c/${item.slug}`}
                className={item.id === category.id ? "pv-chip pv-chip-active" : "pv-chip"}
                aria-current={item.id === category.id ? "page" : undefined}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </SiteChrome>
  );
}
