import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { SitePageView, pageMetadata } from "@/components/preview/public-views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

function findPage(slug: string) {
  return db.page.findFirst({
    where: { slug, status: "PUBLISHED", site: { status: { not: "ARCHIVED" } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(await findPage(slug));
}

/** Legacy public page route (global slug lookup) — kept for old links. */
export default async function PublicPage({ params }: Params) {
  const { slug } = await params;
  const page = await findPage(slug);
  if (!page) notFound();
  return <SitePageView page={page} />;
}
