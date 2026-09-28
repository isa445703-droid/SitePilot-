import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { loadSitePreview, publishedArticles } from "@/lib/preview/data";
import { recordPageView } from "@/lib/analytics";
import { getMessages, translate } from "@/lib/i18n/dictionaries";
import { formatDate, type Locale } from "@/lib/i18n/config";
import { SiteChrome, type DesignTokens } from "@/components/preview/site-chrome";
import { Markdown } from "@/components/preview/markdown";

/** Public rendering for generated sites, shared by the subdomain routes
 *  (/s/[slug]/…) and the legacy global routes (/a|p|c/[slug]). Every query is
 *  scoped to a single resolved site — never global. */

export function siteLocale(language: string): Locale {
  return language === "ru" ? "ru" : language === "ko" ? "ko" : "en";
}

type SiteBundle = NonNullable<Awaited<ReturnType<typeof loadSitePreview>>>;

type ArticleWithCategory = {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string | null;
  tags: string[];
  canonicalUrl: string | null;
  publishedAt: Date | null;
  category: { id: string; name: string; slug: string } | null;
};

type CategoryRecord = {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  description: string;
};

type PageRecord = {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  content: unknown;
  seoTitle: string;
  seoDescription: string;
};

function Chrome({
  data,
  children,
}: {
  data: SiteBundle;
  children: React.ReactNode;
}) {
  const { site, design, settings, categories } = data;
  const locale = siteLocale(site.language);
  return (
    <SiteChrome
      siteName={settings?.siteTitle || site.name}
      siteSlug={site.slug}
      basePath=""
      design={design as DesignTokens}
      categories={categories}
      footerText={settings?.footerText || undefined}
      locale={locale}
      homeLabel={translate(getMessages(locale), "preview.home")}
    >
      {children}
    </SiteChrome>
  );
}

/** Shared renderer for page block arrays (data only — no raw HTML). */
export function Blocks({ content }: { content: unknown }) {
  const blocks = Array.isArray(content) ? (content as Array<Record<string, unknown>>) : [];
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const text = String(block.text ?? "");
          return Number(block.level ?? 2) <= 1 ? (
            <h2 key={index}>{text}</h2>
          ) : (
            <h3 key={index}>{text}</h3>
          );
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

/* -------------------------------------------------------------------------- */
/* Metadata helpers                                                           */
/* -------------------------------------------------------------------------- */

export function siteMetadata(site: { name: string; description: string } | null): Metadata {
  return { title: site?.name ?? "Not found", description: site?.description };
}

export function articleMetadata(article: ArticleWithCategory | null): Metadata {
  return {
    title: article?.title ?? "Not found",
    description: article?.excerpt ?? null,
    alternates: article?.canonicalUrl ? { canonical: article.canonicalUrl } : undefined,
  };
}

export function categoryMetadata(category: CategoryRecord | null): Metadata {
  return { title: category?.name ?? "Not found", description: category?.description || null };
}

export function pageMetadata(page: PageRecord | null): Metadata {
  return {
    title: page?.seoTitle || page?.title || "Not found",
    description: page?.seoDescription || null,
  };
}

/* -------------------------------------------------------------------------- */
/* Views                                                                      */
/* -------------------------------------------------------------------------- */

/** Public home of a generated site (subdomain root). */
export async function SiteHomeView({ slug }: { slug: string }) {
  const site = await db.site.findFirst({
    where: { slug, status: { not: "ARCHIVED" } },
  });
  if (!site) notFound();

  const data = await loadSitePreview(site.id);
  if (!data) notFound();

  const { site: fullSite } = data;
  const locale = siteLocale(fullSite.language);
  const messages = getMessages(locale);
  const [articles, homePage] = await Promise.all([
    publishedArticles(fullSite.id, 6),
    db.page.findFirst({ where: { siteId: fullSite.id, slug: "", status: "PUBLISHED" } }),
  ]);

  await recordPageView(fullSite.id);

  return (
    <Chrome data={data}>
      <section className="pv-hero">
        <h1>{fullSite.name}</h1>
        <p className="pv-hero-sub">{fullSite.description}</p>
        {articles.length > 0 ? (
          <a href="#latest" className="pv-btn">
            {translate(messages, "preview.browseArticles")}
          </a>
        ) : null}
        {homePage?.content ? <Blocks content={homePage.content} /> : null}
      </section>

      <section className="pv-section" id="latest">
        <h2>{translate(messages, "preview.latestArticles")}</h2>
        {articles.length === 0 ? (
          <p>{translate(messages, "preview.noArticles")}</p>
        ) : (
          <div className="pv-card-grid">
            {articles.map((article) => (
              <article key={article.id} className="pv-card">
                {article.category ? (
                  <Link href={`/c/${article.category.slug}`} className="pv-pill">
                    {article.category.name}
                  </Link>
                ) : null}
                <h3>
                  <Link href={`/a/${article.slug}`}>{article.title}</Link>
                </h3>
                <p>{article.excerpt}</p>
                <p className="pv-meta">
                  {translate(messages, "preview.publishedOn", {
                    date: formatDate(article.publishedAt ?? article.updatedAt, locale),
                  })}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="pv-section">
        <h2>{translate(messages, "preview.categories")}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.categories.map((category) => (
            <Link key={category.id} href={`/c/${category.slug}`} className="pv-pill">
              {category.name}
            </Link>
          ))}
        </div>
      </section>
    </Chrome>
  );
}

export async function ArticleView({ article }: { article: ArticleWithCategory }) {
  const data = await loadSitePreview(article.siteId);
  if (!data) notFound();

  const { site } = data;
  await recordPageView(site.id, article.id);
  const locale = siteLocale(site.language);

  return (
    <Chrome data={data}>
      <article>
        {article.category ? (
          <p style={{ marginBottom: "0.4rem" }}>
            <Link className="pv-pill" href={`/c/${article.category.slug}`}>
              {article.category.name}
            </Link>
          </p>
        ) : null}
        <h1>{article.title}</h1>
        <p className="pv-meta">
          {article.publishedAt ? article.publishedAt.toLocaleDateString() : ""}
          {article.author ? ` · ${article.author}` : ""}
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
      <nav aria-label={translate(getMessages(locale), "preview.home")} style={{ marginTop: "2.5rem" }}>
        <Link href="/">← {translate(getMessages(locale), "preview.home")}</Link>
      </nav>
    </Chrome>
  );
}

export async function CategoryView({ category }: { category: CategoryRecord }) {
  const data = await loadSitePreview(category.siteId);
  if (!data) notFound();

  const { site } = data;
  const locale = siteLocale(site.language);
  const messages = getMessages(locale);
  const articles = await db.article.findMany({
    where: { siteId: site.id, categoryId: category.id, status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }],
    take: 50,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  return (
    <Chrome data={data}>
      <section>
        <h1>{category.name}</h1>
        {category.description ? <p className="pv-hero-sub">{category.description}</p> : null}
        {articles.length === 0 ? (
          <p className="pv-section">{translate(messages, "preview.noArticles")}</p>
        ) : (
          <div className="pv-card-grid pv-section">
            {articles.map((article) => (
              <div className="pv-card" key={article.id}>
                <h3>
                  <Link href={`/a/${article.slug}`}>{article.title}</Link>
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
    </Chrome>
  );
}

export async function SitePageView({ page }: { page: PageRecord }) {
  const data = await loadSitePreview(page.siteId);
  if (!data) notFound();

  const { site } = data;
  await recordPageView(site.id);
  const locale = siteLocale(site.language);

  return (
    <Chrome data={data}>
      <article>
        <h1>{page.title}</h1>
        <Blocks content={page.content} />
      </article>
      <nav aria-label={translate(getMessages(locale), "preview.home")} style={{ marginTop: "2.5rem" }}>
        <Link href="/">← {translate(getMessages(locale), "preview.home")}</Link>
      </nav>
    </Chrome>
  );
}
