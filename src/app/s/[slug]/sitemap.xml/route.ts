import { db } from "@/lib/db/prisma";
import { buildSitemap, type SitemapEntry } from "@/lib/seo";
import { siteOrigin } from "@/lib/site-url";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /sitemap.xml on a site subdomain — the machine-readable map of the
 * generated site with absolute subdomain URLs.
 */
export async function GET(_req: Request, { params }: Params) {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const site = await db.site.findFirst({ where: { slug, status: { not: "ARCHIVED" } } });
  if (!site) return new Response("Not found", { status: 404 });

  const origin = siteOrigin(slug);
  const [articles, categories, pages] = await Promise.all([
    db.article.findMany({
      where: { siteId: site.id, status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 500,
    }),
    db.category.findMany({ where: { siteId: site.id }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { siteId: site.id }, select: { slug: true, updatedAt: true } }),
  ]);

  const entries: SitemapEntry = [
    { path: `${origin}/`, lastmod: site.updatedAt },
    ...pages.filter((page) => page.slug).map((page) => ({ path: `${origin}/p/${page.slug}`, lastmod: page.updatedAt })),
    ...categories.map((category) => ({ path: `${origin}/c/${category.slug}`, lastmod: category.updatedAt })),
    ...articles.map((article) => ({ path: `${origin}/a/${article.slug}`, lastmod: article.updatedAt })),
  ];

  return new Response(buildSitemap(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
