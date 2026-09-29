import { slugify } from "@/lib/utils/slug";

/** SEO helpers shared by the audit, the editor and the preview renderer. */

export const SEO_LIMITS = {
  title: 60,
  description: 155,
  slug: 60,
} as const;

export type MetaTags = {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    siteName: string;
  };
};

export function buildMeta(input: {
  title: string;
  description: string;
  siteName: string;
  url: string;
  indexable: boolean;
}): MetaTags {
  const title = input.title.slice(0, 160);
  const description = input.description.slice(0, 300);
  return {
    title,
    description,
    canonical: input.url,
    robots: input.indexable ? "index, follow" : "noindex, nofollow",
    openGraph: {
      title,
      description,
      url: input.url,
      type: "article",
      siteName: input.siteName,
    },
  };
}

export type TruncationFlag = { value: string; length: number; limit: number; over: boolean };

export function checkTitle(value: string): TruncationFlag {
  return { value, length: value.length, limit: SEO_LIMITS.title, over: value.length > SEO_LIMITS.title };
}

export function checkDescription(value: string): TruncationFlag {
  return {
    value,
    length: value.length,
    limit: SEO_LIMITS.description,
    over: value.length > SEO_LIMITS.description,
  };
}

/** Deterministic robots.txt for a generated site. */
export function buildRobots(baseUrl: string, options: { indexable?: boolean } = {}): string {
  const origin = baseUrl.replace(/\/$/, "");
  // A site opted out of indexing gets no crawl budget spent on it — the same
  // switch the <meta name="robots"> tag honours.
  if (options.indexable === false) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

export type SitemapEntry = { path: string; lastmod?: Date | null }[];

export function buildSitemap(entries: SitemapEntry): string {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastmod ? entry.lastmod.toISOString().slice(0, 10) : null;
    return [
      "  <url>",
      `    <loc>${escapeXml(entry.path)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Derives a meta description from body text when none was written. */
export function excerptFromBody(content: string, limit = 155): string {
  const text = content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

export function canonicalSlug(title: string): string {
  return slugify(title, "page");
}
