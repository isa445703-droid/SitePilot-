import { db } from "@/lib/db/prisma";
import { buildRobots } from "@/lib/seo";
import { siteOrigin } from "@/lib/site-url";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /robots.txt on a site subdomain — crawl directives for the generated
 * site. Mirrors the sitemap route: the same slug lookup, and the site's own
 * `indexable` switch decides between "crawl me" and "stay out".
 */
export async function GET(_req: Request, { params }: Params) {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const site = await db.site.findFirst({
    where: { slug, status: { not: "ARCHIVED" } },
    select: { settings: { select: { indexable: true } } },
  });
  if (!site) return new Response("Not found", { status: 404 });

  const body = buildRobots(siteOrigin(slug), {
    indexable: site.settings?.indexable ?? true,
  });

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
