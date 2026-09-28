import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { CategoryView, categoryMetadata } from "@/components/preview/public-views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; categorySlug: string }> };

function findCategory(slug: string, categorySlug: string) {
  return db.category.findFirst({
    where: { slug: categorySlug, site: { slug, status: { not: "ARCHIVED" } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  return categoryMetadata(await findCategory(slug, categorySlug));
}

/** Category archive scoped to its site (served on the site subdomain). */
export default async function PublicSiteCategory({ params }: Params) {
  const { slug, categorySlug } = await params;
  const category = await findCategory(slug, categorySlug);
  if (!category) notFound();
  return <CategoryView category={category} />;
}
