import type { Metadata } from "next";
import { db } from "@/lib/db/prisma";
import { SiteHomeView, siteMetadata } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const site = await db.site.findFirst({
    where: { slug, status: { not: "ARCHIVED" } },
    include: { settings: { select: { indexable: true } } },
  });
  return siteMetadata(site, { canonicalUrl: `/s/${slug}`, indexable: site?.settings?.indexable });
}

/** Public home of a generated site, served at the site subdomain root. */
export default async function PublicSiteHome({ params }: Params) {
  const { slug: raw } = await params;
  return <SiteHomeView slug={decodeRouteParam(raw)} />;
}
