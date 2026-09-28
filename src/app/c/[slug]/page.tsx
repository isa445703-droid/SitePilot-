import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { CategoryView, categoryMetadata } from "@/components/preview/public-views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

function findCategory(slug: string) {
  return db.category.findFirst({
    where: { slug, site: { status: { not: "ARCHIVED" } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return categoryMetadata(await findCategory(slug));
}

/** Legacy public category route (global slug lookup) — kept for old links. */
export default async function PublicCategory({ params }: Params) {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) notFound();
  return <CategoryView category={category} />;
}
