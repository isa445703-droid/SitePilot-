import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { loadSitePreview } from "@/lib/preview/data";
import { recordPageView } from "@/lib/analytics";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/config";
import { SiteChrome } from "@/components/preview/site-chrome";
import { ArticleCard, SectionHead } from "@/components/preview/site-parts";
import { Blocks } from "@/components/preview/public-views";

export const metadata: Metadata = { title: "Preview" };

type Params = { params: Promise<{ siteId: string }> };

export default async function PreviewHomePage({ params }: Params) {
  const user = await requireUser();
  const { siteId } = await params;
  const owned = await getOwnedSite(siteId, user.id);
  if (!owned) notFound();

  const data = await loadSitePreview(siteId);
  if (!data) notFound();

  const { site, design, settings, categories } = data;
  const { t, locale } = await getServerI18n();
  const articles = await db.article.findMany({
    where: { siteId: site.id, status: { not: "ARCHIVED" } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 7,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  const homePage = await db.page.findFirst({
    where: { siteId: site.id, slug: "", status: "PUBLISHED" },
  });

  await recordPageView(site.id);

  const basePath = `/preview/${site.id}`;
  const [lead, ...rest] = articles;

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
      <section className="pv-hero">
        <h1>{site.name}</h1>
        {site.description ? <p className="pv-hero-sub">{site.description}</p> : null}
        {articles.length > 0 ? (
          <div className="pv-hero-actions">
            <a href="#latest" className="pv-btn">
              {t("preview.browseArticles")}
            </a>
          </div>
        ) : null}
        {homePage?.content ? (
          <div className="pv-hero-blocks">
            <Blocks content={homePage.content} />
          </div>
        ) : null}
      </section>

      <section className="pv-section" id="latest">
        <SectionHead title={t("preview.latestArticles")} />
        {articles.length === 0 ? (
          <p className="pv-empty">{t("preview.noArticles")}</p>
        ) : (
          <div className="pv-card-grid">
            {lead ? (
              <ArticleCard
                article={lead}
                href={`${basePath}/a/${lead.slug}`}
                categoryHref={lead.category ? `${basePath}/c/${lead.category.slug}` : undefined}
                meta={formatDate(lead.publishedAt ?? lead.createdAt, locale)}
                featured
                status={lead.status === "PUBLISHED" ? null : lead.status}
              />
            ) : null}
            {rest.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                href={`${basePath}/a/${article.slug}`}
                categoryHref={article.category ? `${basePath}/c/${article.category.slug}` : undefined}
                meta={formatDate(article.publishedAt ?? article.createdAt, locale)}
                status={article.status === "PUBLISHED" ? null : article.status}
              />
            ))}
          </div>
        )}
      </section>

      {categories.length > 0 ? (
        <section className="pv-section">
          <SectionHead title={t("preview.categories")} />
          <div className="pv-chip-grid">
            {categories.map((category) => (
              <Link key={category.id} href={`${basePath}/c/${category.slug}`} className="pv-chip">
                <span className="pv-chip-name">{category.name}</span>
                {category.description ? <span className="pv-chip-desc">{category.description}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </SiteChrome>
  );
}
