import { getSession } from "@/lib/auth/session";
import { getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { buildSitemap, type SitemapEntry } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ siteId: string }> };

/**
 * GET /preview/:siteId/sitemap.xml — machine-readable output for the
 * generated site (owner session required while the site lives in SitePilot).
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session.user.id);
  if (!site) return new Response("Not found", { status: 404 });

  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const base = `${origin}/preview/${site.id}`;

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
    { path: `${base}/`, lastmod: site.updatedAt },
    ...pages.filter((page) => page.slug).map((page) => ({ path: `${base}/p/${page.slug}`, lastmod: page.updatedAt })),
    ...categories.map((category) => ({ path: `${base}/c/${category.slug}`, lastmod: category.updatedAt })),
    ...articles.map((article) => ({ path: `${base}/a/${article.slug}`, lastmod: article.updatedAt })),
  ];

  return new Response(buildSitemap(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
