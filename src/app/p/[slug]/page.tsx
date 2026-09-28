import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { SitePageView, pageMetadata } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

async function findPage(slug: string) {
  return db.page.findFirst({
    where: { slug, status: "PUBLISHED", site: { status: { not: "ARCHIVED" } } },
    include: { site: { select: { slug: true, settings: { select: { indexable: true } } } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const page = await findPage(slug);
  return pageMetadata(page, {
    canonicalUrl: page ? `/s/${page.site.slug}/p/${page.slug}` : undefined,
    indexable: page?.site.settings?.indexable,
  });
}

/** Legacy public page route (global slug lookup) — renders the owning site. */
export default async function PublicPage({ params }: Params) {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const page = await findPage(slug);
  if (!page) notFound();
  return <SitePageView page={page} basePath={`/s/${page.site.slug}`} />;
}
