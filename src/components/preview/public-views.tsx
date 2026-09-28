import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { loadSitePreview, publishedArticles } from "@/lib/preview/data";
import { recordPageView } from "@/lib/analytics";
import { getMessages, translate, type Messages } from "@/lib/i18n/dictionaries";
import { formatDate, type Locale } from "@/lib/i18n/config";
import { SiteChrome, type DesignTokens } from "@/components/preview/site-chrome";
import { ArticleCard, Breadcrumbs, SectionHead, type CardArticle } from "@/components/preview/site-parts";
import { Markdown } from "@/components/preview/markdown";

/** Public rendering for generated sites, shared by the subdomain routes
 *  (/s/[slug]/…) and the legacy global routes (/a|p|c/[slug]). Every query is
 *  scoped to a single resolved site — never global.
 *
 *  All internal links are built from the site's own base path. The legacy
 *  /c/[slug] style routes stay available for old inbound links, but pages never
 *  point at them: a bare /c/<slug> is ambiguous once two sites use the same
 *  category slug, which used to send visitors to a 404 or to another site's
 *  content. */

export function siteLocale(language: string): Locale {
  return language === "ru" ? "ru" : language === "ko" ? "ko" : "en";
}

type SiteBundle = NonNullable<Awaited<ReturnType<typeof loadSitePreview>>>;

type ArticleWithCategory = {
  id: string;
  siteId: string;
  categoryId?: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string | null;
  tags: string[];
  canonicalUrl: string | null;
  publishedAt: Date | null;
  wordCount?: number;
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
  basePath,
  children,
}: {
  data: SiteBundle;
  /** Site-scoped prefix every internal link is built from. */
  basePath: string;
  children: React.ReactNode;
}) {
  const { site, design, settings, categories } = data;
  const locale = siteLocale(site.language);
  return (
    <SiteChrome
      siteName={settings?.siteTitle || site.name}
      siteSlug={site.slug}
      basePath={basePath}
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

export function siteMetadata(
  site: { name: string; description: string } | null,
  options: MetaOptions = {},
): Metadata {
  return {
    title: site?.name ?? "Not found",
    description: site?.description,
    alternates: options.canonicalUrl ? { canonical: options.canonicalUrl } : undefined,
    robots: robots(options.indexable),
  };
}

type MetaOptions = { canonicalUrl?: string; indexable?: boolean };

/** The dashboard is noindex by default; a published generated site opts in. */
function robots(indexable: boolean | undefined) {
  return { index: indexable === true, follow: indexable === true };
}

export function articleMetadata(
  article: ArticleWithCategory | null,
  options: MetaOptions = {},
): Metadata {
  const canonical = article?.canonicalUrl || options.canonicalUrl;
  return {
    title: article?.title ?? "Not found",
    description: article?.excerpt ?? null,
    alternates: canonical ? { canonical } : undefined,
    robots: robots(options.indexable),
  };
}

export function categoryMetadata(
  category: CategoryRecord | null,
  options: MetaOptions = {},
): Metadata {
  return {
    title: category?.name ?? "Not found",
    description: category?.description || null,
    alternates: options.canonicalUrl ? { canonical: options.canonicalUrl } : undefined,
    robots: robots(options.indexable),
  };
}

export function pageMetadata(page: PageRecord | null, options: MetaOptions = {}): Metadata {
  return {
    title: page?.seoTitle || page?.title || "Not found",
    description: page?.seoDescription || null,
    alternates: options.canonicalUrl ? { canonical: options.canonicalUrl } : undefined,
    robots: robots(options.indexable),
  };
}

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

/** Meta line for an article page: date, author, reading time. */
function ArticleMeta({
  article,
  locale,
  messages,
}: {
  article: ArticleWithCategory;
  locale: Locale;
  messages: Messages;
}) {
  const parts = [
    translate(messages, "preview.publishedOn", {
      date: formatDate(article.publishedAt ?? new Date(), locale),
    }),
  ];
  if (article.author) parts.push(article.author);
  if (article.wordCount) parts.push(translate(messages, "editor.wordCount", { count: article.wordCount }));
  return <p className="pv-meta pv-article-meta">{parts.join(" · ")}</p>;
}

/** Card wired to the site's own routes, with the localized date line. */
function ArticleTile({
  article,
  basePath,
  locale,
  messages,
  featured = false,
}: {
  article: CardArticle;
  basePath: string;
  locale: Locale;
  messages: Messages;
  featured?: boolean;
}) {
  return (
    <ArticleCard
      article={article}
      href={`${basePath}/a/${article.slug}`}
      categoryHref={article.category ? `${basePath}/c/${article.category.slug}` : undefined}
      meta={translate(messages, "preview.publishedOn", {
        date: formatDate(article.publishedAt ?? article.updatedAt ?? new Date(), locale),
      })}
      featured={featured}
    />
  );
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
  const basePath = `/s/${fullSite.slug}`;
  const locale = siteLocale(fullSite.language);
  const messages = getMessages(locale);
  const [articles, homePage] = await Promise.all([
    publishedArticles(fullSite.id, 7),
    db.page.findFirst({ where: { siteId: fullSite.id, slug: "", status: "PUBLISHED" } }),
  ]);

  await recordPageView(fullSite.id);

  const [lead, ...rest] = articles;

  return (
    <Chrome data={data} basePath={basePath}>
      <section className="pv-hero">
        <h1>{fullSite.name}</h1>
        {fullSite.description ? <p className="pv-hero-sub">{fullSite.description}</p> : null}
        <div className="pv-hero-actions">
          {articles.length > 0 ? (
            <a href="#latest" className="pv-btn">
              {translate(messages, "preview.browseArticles")}
            </a>
          ) : null}
          {data.categories.length > 0 ? (
            <Link href={`${basePath}/c/${data.categories[0].slug}`} className="pv-btn pv-btn-ghost">
              {translate(messages, "preview.categories")}
            </Link>
          ) : null}
        </div>
        {homePage?.content ? <div className="pv-hero-blocks"><Blocks content={homePage.content} /></div> : null}
      </section>

      <section className="pv-section" id="latest">
        <SectionHead title={translate(messages, "preview.latestArticles")} />
        {articles.length === 0 ? (
          <p className="pv-empty">{translate(messages, "preview.noArticles")}</p>
        ) : (
          <div className="pv-card-grid">
            {lead ? (
              <ArticleTile article={lead} basePath={basePath} locale={locale} messages={messages} featured />
            ) : null}
            {rest.map((article) => (
              <ArticleTile key={article.id} article={article} basePath={basePath} locale={locale} messages={messages} />
            ))}
          </div>
        )}
      </section>

      {data.categories.length > 0 ? (
        <section className="pv-section">
          <SectionHead title={translate(messages, "preview.categories")} />
          <div className="pv-chip-grid">
            {data.categories.map((category) => (
              <Link key={category.id} href={`${basePath}/c/${category.slug}`} className="pv-chip">
                <span className="pv-chip-name">{category.name}</span>
                {category.description ? <span className="pv-chip-desc">{category.description}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </Chrome>
  );
}

export async function ArticleView({ article, basePath = "" }: { article: ArticleWithCategory; basePath?: string }) {
  const data = await loadSitePreview(article.siteId);
  if (!data) notFound();

  const { site } = data;
  await recordPageView(site.id, article.id);
  const locale = siteLocale(site.language);
  const messages = getMessages(locale);
  const resolvedBase = basePath || `/s/${site.slug}`;

  const related = await db.article.findMany({
    where: {
      siteId: site.id,
      status: "PUBLISHED",
      id: { not: article.id },
      categoryId: article.categoryId ?? undefined,
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  return (
    <Chrome data={data} basePath={resolvedBase}>
      <article className="pv-article">
        <Breadcrumbs
          basePath={resolvedBase}
          homeLabel={translate(messages, "preview.home")}
          current={article.category?.name}
          currentHref={article.category ? `${resolvedBase}/c/${article.category.slug}` : undefined}
        />

        <header className="pv-article-head">
          <h1>{article.title}</h1>
          <ArticleMeta article={article} locale={locale} messages={messages} />
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
          <Link href={resolvedBase} className="pv-btn pv-btn-ghost">
            ← {translate(messages, "preview.home")}
          </Link>
        </footer>
      </article>

      {related.length > 0 ? (
        <section className="pv-section">
          <SectionHead title={translate(messages, "preview.latestArticles")} />
          <div className="pv-card-grid">
            {related.map((item) => (
              <ArticleTile
                key={item.id}
                article={item as CardArticle}
                basePath={resolvedBase}
                locale={locale}
                messages={messages}
              />
            ))}
          </div>
        </section>
      ) : null}
    </Chrome>
  );
}

export async function CategoryView({ category, basePath = "" }: { category: CategoryRecord; basePath?: string }) {
  const data = await loadSitePreview(category.siteId);
  if (!data) notFound();

  const { site } = data;
  const locale = siteLocale(site.language);
  const messages = getMessages(locale);
  const resolvedBase = basePath || `/s/${site.slug}`;
  const articles = await db.article.findMany({
    where: { siteId: site.id, categoryId: category.id, status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }],
    take: 50,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  return (
    <Chrome data={data} basePath={resolvedBase}>
      <section className="pv-page-head">
        <Breadcrumbs basePath={resolvedBase} homeLabel={translate(messages, "preview.home")} />
        <h1>{category.name}</h1>
        {category.description ? <p className="pv-hero-sub">{category.description}</p> : null}
        <p className="pv-meta">
          {articles.length} {translate(messages, "preview.latestArticles").toLowerCase()}
        </p>
      </section>

      {articles.length === 0 ? (
        <p className="pv-empty">{translate(messages, "preview.noArticles")}</p>
      ) : (
        <div className="pv-card-grid">
          {articles.map((article) => (
            <ArticleTile
              key={article.id}
              article={article as CardArticle}
              basePath={resolvedBase}
              locale={locale}
              messages={messages}
            />
          ))}
        </div>
      )}

      {data.categories.length > 1 ? (
        <section className="pv-section">
          <SectionHead title={translate(messages, "preview.categories")} />
          <div className="pv-chip-row">
            {data.categories.map((item) => (
              <Link
                key={item.id}
                href={`${resolvedBase}/c/${item.slug}`}
                className={item.id === category.id ? "pv-chip pv-chip-active" : "pv-chip"}
                aria-current={item.id === category.id ? "page" : undefined}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </Chrome>
  );
}

export async function SitePageView({ page, basePath = "" }: { page: PageRecord; basePath?: string }) {
  const data = await loadSitePreview(page.siteId);
  if (!data) notFound();

  const { site } = data;
  await recordPageView(site.id);
  const locale = siteLocale(site.language);
  const messages = getMessages(locale);
  const resolvedBase = basePath || `/s/${site.slug}`;

  return (
    <Chrome data={data} basePath={resolvedBase}>
      <article className="pv-article pv-page">
        <Breadcrumbs basePath={resolvedBase} homeLabel={translate(messages, "preview.home")} />
        <header className="pv-article-head">
          <h1>{page.title}</h1>
        </header>
        <div className="pv-prose-body">
          <Blocks content={page.content} />
        </div>
        <footer className="pv-article-foot">
          <Link href={resolvedBase} className="pv-btn pv-btn-ghost">
            ← {translate(messages, "preview.home")}
          </Link>
        </footer>
      </article>
    </Chrome>
  );
}
