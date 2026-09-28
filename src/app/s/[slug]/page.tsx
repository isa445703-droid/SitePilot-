import type { Metadata } from "next";
import { db } from "@/lib/db/prisma";
import { SiteHomeView, siteMetadata } from "@/components/preview/public-views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findFirst({ where: { slug, status: { not: "ARCHIVED" } } });
  return siteMetadata(site);
}

/** Public home of a generated site, served at the site subdomain root. */
export default async function PublicSiteHome({ params }: Params) {
  const { slug } = await params;
  return <SiteHomeView slug={slug} />;
}
