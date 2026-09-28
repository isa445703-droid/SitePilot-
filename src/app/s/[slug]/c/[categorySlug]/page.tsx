import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { CategoryView, categoryMetadata } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; categorySlug: string }> };

function findCategory(slug: string, categorySlug: string) {
  return db.category.findFirst({
    where: { slug: categorySlug, site: { slug, status: { not: "ARCHIVED" } } },
    include: { site: { select: { settings: { select: { indexable: true } } } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: rawSlug, categorySlug: rawCategory } = await params;
  const slug = decodeRouteParam(rawSlug);
  const categorySlug = decodeRouteParam(rawCategory);
  const category = await findCategory(slug, categorySlug);
  return categoryMetadata(category, {
    canonicalUrl: `/s/${slug}/c/${categorySlug}`,
    indexable: category?.site.settings?.indexable,
  });
}

/** Category archive scoped to its site (served on the site subdomain). */
export default async function PublicSiteCategory({ params }: Params) {
  const { slug: rawSlug, categorySlug: rawCategory } = await params;
  const slug = decodeRouteParam(rawSlug);
  const categorySlug = decodeRouteParam(rawCategory);
  const category = await findCategory(slug, categorySlug);
  if (!category) notFound();
  return <CategoryView category={category} basePath={`/s/${slug}`} />;
}
