import "server-only";
import { db } from "@/lib/db/prisma";
import type { AgentName } from "./permissions";
import { assertPermission } from "./permissions";

export type SiteBundle = {
  site: any;
  brand: any;
  design: any;
  settings: any;
  schedule: any;
  categories: any[];
  stats: { articles: number; published: number; queued: number; seoIssues: number };
};

/** Central read helper — every agent goes through `read_site`. */
export async function loadSiteBundle(agent: AgentName, siteId: string): Promise<SiteBundle> {
  assertPermission(agent, "read_site");

  const site = await db.site.findUnique({
    where: { id: siteId },
    include: {
      brand: true,
      design: true,
      settings: true,
      schedule: true,
      categories: { orderBy: { order: "asc" } },
      _count: { select: { articles: true, tasks: true } },
    },
  });
  if (!site) throw new Error(`Site ${siteId} not found`);

  const [published, queued, seoIssues] = await Promise.all([
    db.article.count({ where: { siteId, status: "PUBLISHED" } }),
    db.agentTask.count({ where: { siteId, status: { in: ["QUEUED", "RUNNING"] } } }),
    db.seoIssue.count({ where: { siteId, resolved: false } }),
  ]);

  return {
    site,
    brand: site.brand,
    design: site.design,
    settings: site.settings,
    schedule: site.schedule,
    categories: site.categories,
    stats: {
      articles: site._count.articles,
      published,
      queued,
      seoIssues,
    },
  };
}

export function brandVoiceOf(bundle: SiteBundle): string {
  const brand = bundle.brand;
  if (!brand) return "";
  return [brand.brandVoice, brand.tone, brand.guidelines].filter(Boolean).join(" ").trim();
}

export function audienceOf(bundle: SiteBundle): string {
  return bundle.site.targetAudience || "";
}
