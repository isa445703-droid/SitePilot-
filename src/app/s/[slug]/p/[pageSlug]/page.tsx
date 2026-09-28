import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { SitePageView, pageMetadata } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; pageSlug: string }> };

function findPage(slug: string, pageSlug: string) {
  return db.page.findFirst({
    where: { slug: pageSlug, status: "PUBLISHED", site: { slug, status: { not: "ARCHIVED" } } },
    include: { site: { select: { settings: { select: { indexable: true } } } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: rawSlug, pageSlug: rawPage } = await params;
  const slug = decodeRouteParam(rawSlug);
  const pageSlug = decodeRouteParam(rawPage);
  const page = await findPage(slug, pageSlug);
  return pageMetadata(page, {
    canonicalUrl: `/s/${slug}/p/${pageSlug}`,
    indexable: page?.site.settings?.indexable,
  });
}

/** Static page scoped to its site (served on the site subdomain). */
export default async function PublicSitePage({ params }: Params) {
  const { slug: rawSlug, pageSlug: rawPage } = await params;
  const slug = decodeRouteParam(rawSlug);
  const pageSlug = decodeRouteParam(rawPage);
  const page = await findPage(slug, pageSlug);
  if (!page) notFound();
  return <SitePageView page={page} basePath={`/s/${slug}`} />;
}
