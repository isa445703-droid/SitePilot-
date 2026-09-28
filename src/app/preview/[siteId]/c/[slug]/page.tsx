import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { loadSitePreview } from "@/lib/preview/data";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/config";
import { SiteChrome } from "@/components/preview/site-chrome";

export const metadata: Metadata = { title: "Preview" };

type Params = { params: Promise<{ siteId: string; slug: string }> };

export default async function PreviewCategoryPage({ params }: Params) {
  const user = await requireUser();
  const { siteId, slug } = await params;
  const owned = await getOwnedSite(siteId, user.id);
  if (!owned) notFound();

  const data = await loadSitePreview(siteId);
  if (!data) notFound();

  const { site, design, settings, categories } = data;
  const category = await db.category.findFirst({ where: { siteId: site.id, slug } });
  if (!category) notFound();

  const [articles, related] = await Promise.all([
    db.article.findMany({
      where: { siteId: site.id, categoryId: category.id, status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }],
      take: 50,
    }),
    Promise.resolve(categories),
  ]);

  const { t, locale } = await getServerI18n();
  const basePath = `/preview/${site.id}`;

  return (
    <SiteChrome
      siteName={settings?.siteTitle || site.name}
      siteSlug={site.slug}
      basePath={basePath}
      design={design}
      categories={related}
      footerText={settings?.footerText || undefined}
      locale={locale}
      homeLabel={t("preview.home")}
      previewBar={
        <div className="border-b border-line bg-accent-soft px-3 py-1.5 text-center text-xs text-accent">
          {t("preview.previewNotice")}
        </div>
      }
    >
      <section>
        <h1>{category.name}</h1>
        {category.description ? <p className="pv-hero-sub">{category.description}</p> : null}

        {articles.length === 0 ? (
          <p className="pv-section">{t("preview.noArticles")}</p>
        ) : (
          <div className="pv-card-grid pv-section">
            {articles.map((article) => (
              <div className="pv-card" key={article.id}>
                <h3>
                  <Link href={`${basePath}/a/${article.slug}`}>{article.title}</Link>
                </h3>
                {article.excerpt ? <p>{article.excerpt}</p> : null}
                <p className="pv-meta">
                  {formatDate(article.publishedAt ?? article.updatedAt, locale)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteChrome>
  );
}
