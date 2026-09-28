import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { loadSitePreview, publishedArticles } from "@/lib/preview/data";
import { recordPageView } from "@/lib/analytics";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/config";
import { SiteChrome } from "@/components/preview/site-chrome";
import { Markdown } from "@/components/preview/markdown";

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
  const articles = await publishedArticles(site.id, 6);
  const homePage = await db.page.findFirst({
    where: { siteId: site.id, slug: "", status: "PUBLISHED" },
  });

  await recordPageView(site.id);

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
      <section className="pv-hero">
        <h1>{site.name}</h1>
        <p className="pv-hero-sub">{site.description}</p>
        {articles.length > 0 ? (
          <a href="#latest" className="pv-btn">
            {t("preview.browseArticles")}
          </a>
        ) : null}
        {homePage?.content ? <Blocks content={homePage.content} /> : null}
      </section>

      <section className="pv-section" id="latest">
        <h2>{t("preview.latestArticles")}</h2>
        {articles.length === 0 ? (
          <p>{t("preview.noArticles")}</p>
        ) : (
          <div className="pv-card-grid">
            {articles.map((article) => (
              <article key={article.id} className="pv-card">
                {article.category ? (
                  <Link href={`${basePath}/c/${article.category.slug}`} className="pv-pill">
                    {article.category.name}
                  </Link>
                ) : null}
                <h3>
                  <Link href={`${basePath}/a/${article.slug}`}>{article.title}</Link>
                </h3>
                <p>{article.excerpt}</p>
                <p className="pv-meta">
                  {t("preview.publishedOn", {
                    date: formatDate(article.publishedAt ?? article.updatedAt, locale),
                  })}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="pv-section">
        <h2>{t("preview.categories")}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link key={category.id} href={`${basePath}/c/${category.slug}`} className="pv-pill">
              {category.name}
            </Link>
          ))}
        </div>
      </section>
    </SiteChrome>
  );
}

/** Page blocks stored as JSON (data only). */
function Blocks({ content }: { content: unknown }) {
  const blocks = Array.isArray(content) ? (content as Array<Record<string, unknown>>) : [];
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const text = String(block.text ?? "");
          const level = Number(block.level ?? 2);
          if (level <= 1) return <h2 key={index}>{text}</h2>;
          return <h3 key={index}>{text}</h3>;
        }
        if (block.type === "list") {
          const items = Array.isArray(block.items) ? (block.items as string[]) : [];
          return (
            <ul key={index}>
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "quote") return <blockquote key={index}>{String(block.text ?? "")}</blockquote>;
        return <Markdown key={index} content={String(block.text ?? "")} />;
      })}
    </>
  );
}
