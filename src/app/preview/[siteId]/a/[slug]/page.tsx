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
import { Markdown } from "@/components/preview/markdown";

export const metadata: Metadata = { title: "Preview" };

type Params = { params: Promise<{ siteId: string; slug: string }> };

export default async function PreviewArticlePage({ params }: Params) {
  const user = await requireUser();
  const { siteId, slug } = await params;
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
      <article>
        {article.category ? (
          <p style={{ marginBottom: "0.4rem" }}>
            <Link className="pv-pill" href={`${basePath}/c/${article.category.slug}`}>
              {article.category.name}
            </Link>
          </p>
        ) : null}
        <h1>{article.title}</h1>
        <p className="pv-meta">
          {t("preview.publishedOn", {
            date: formatDate(article.publishedAt ?? article.updatedAt, locale),
          })}
          {article.author ? ` · ${article.author}` : ""}
          {` · ${t("editor.wordCount", { count: article.wordCount })}`}
        </p>

        {article.excerpt ? <p className="pv-lead">{article.excerpt}</p> : null}

        <Markdown content={article.content || ""} />

        {article.tags.length > 0 ? (
          <p className="pv-pill-list">
            {article.tags.map((tag) => (
              <span className="pv-pill" key={tag}>
                #{tag}
              </span>
            ))}
          </p>
        ) : null}
      </article>

      <nav aria-label={t("preview.categories")} style={{ marginTop: "2.5rem" }}>
        <Link href={basePath}>← {t("common.goHome")}</Link>
      </nav>
    </SiteChrome>
  );
}
