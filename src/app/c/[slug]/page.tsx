import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { CategoryView, categoryMetadata } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

async function findCategory(slug: string) {
  return db.category.findFirst({
    where: { slug, site: { status: { not: "ARCHIVED" } } },
    include: { site: { select: { slug: true, settings: { select: { indexable: true } } } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const category = await findCategory(slug);
  return categoryMetadata(category, {
    canonicalUrl: category ? `/s/${category.site.slug}/c/${category.slug}` : undefined,
    indexable: category?.site.settings?.indexable,
  });
}

/**
 * Legacy public category route (global slug lookup) — kept for old inbound
 * links. It renders the owning site's category and points every internal link
 * at the site-scoped URL, so a bare /c/<slug> can no longer leak another site's
 * content or dead-end on a 404. The canonical URL is advertised in metadata.
 */
export default async function PublicCategory({ params }: Params) {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const category = await findCategory(slug);
  if (!category) notFound();
  return <CategoryView category={category} basePath={`/s/${category.site.slug}`} />;
}
