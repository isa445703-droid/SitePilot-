import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/prisma";
import { SitePageView, pageMetadata } from "@/components/preview/public-views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; pageSlug: string }> };

function findPage(slug: string, pageSlug: string) {
  return db.page.findFirst({
    where: { slug: pageSlug, status: "PUBLISHED", site: { slug, status: { not: "ARCHIVED" } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  return pageMetadata(await findPage(slug, pageSlug));
}

/** Static page scoped to its site (served on the site subdomain). */
export default async function PublicSitePage({ params }: Params) {
  const { slug, pageSlug } = await params;
  const page = await findPage(slug, pageSlug);
  if (!page) notFound();
  return <SitePageView page={page} />;
}
