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
import { Breadcrumbs } from "@/components/preview/site-parts";
import { Markdown } from "@/components/preview/markdown";
import { decodeRouteParam } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Preview" };

type Params = { params: Promise<{ siteId: string; slug: string }> };

export default async function PreviewArticlePage({ params }: Params) {
  const user = await requireUser();
  const { siteId, slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const owned = await getOwnedSite(siteId, user.id);
  if (!owned) notFound();

  const data = await loadSitePreview(siteId);
  if (!data) notFound();

  const { site, design, settings, categories } = data;
  const article = await db.article.findFirst({
    where: { siteId: site.id, slug, status: { not: "ARCHIVED" } },
    include: { category: true },
  });
  if (!article) notFound();

  const { t, locale } = await getServerI18n();
  if (article.status === "PUBLISHED") await recordPageView(site.id, article.id);

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
      <article className="pv-article">
        <Breadcrumbs
          basePath={basePath}
          homeLabel={t("preview.home")}
          current={article.category?.name}
          currentHref={article.category ? `${basePath}/c/${article.category.slug}` : undefined}
        />

        <header className="pv-article-head">
          <h1>{article.title}</h1>
          <p className="pv-meta pv-article-meta">
            {article.status === "PUBLISHED" ? null : <span className="pv-status">{article.status}</span>}
            {formatDate(article.publishedAt ?? article.createdAt, locale)}
            {article.author ? ` · ${article.author}` : ""}
            {article.wordCount ? ` · ${t("editor.wordCount", { count: article.wordCount })}` : ""}
          </p>
        </header>

        {article.excerpt ? <p className="pv-lead">{article.excerpt}</p> : null}

        <Markdown className="pv-prose-body" content={article.content || ""} />

        {article.tags.length > 0 ? (
          <div className="pv-pill-list">
            {article.tags.map((tag) => (
              <span className="pv-tag" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <footer className="pv-article-foot">
          <Link href={basePath} className="pv-btn pv-btn-ghost">
            ← {t("common.goHome")}
          </Link>
        </footer>
      </article>
    </SiteChrome>
  );
}
