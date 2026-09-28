import "server-only";
import { db } from "@/lib/db/prisma";

export type PreviewDesign = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontStyle: string;
  layoutStyle: string;
  cardStyle: string;
  borderRadius: number;
};

export const DEFAULT_PREVIEW_DESIGN: PreviewDesign = {
  primaryColor: "#2563eb",
  secondaryColor: "#0f172a",
  backgroundColor: "#ffffff",
  textColor: "#0f172a",
  fontStyle: "modern",
  layoutStyle: "centered",
  cardStyle: "soft",
  borderRadius: 12,
};

export async function loadSitePreview(siteId: string) {
  const site = await db.site.findUnique({
    where: { id: siteId },
    include: {
      design: true,
      settings: true,
      categories: { orderBy: { name: "asc" } },
    },
  });
  if (!site) return null;

  const design: PreviewDesign = site.design
    ? {
        primaryColor: site.design.primaryColor,
        secondaryColor: site.design.secondaryColor,
        backgroundColor: site.design.backgroundColor,
        textColor: site.design.textColor,
        fontStyle: site.design.fontStyle,
        layoutStyle: site.design.layoutStyle,
        cardStyle: site.design.cardStyle,
        borderRadius: site.design.borderRadius,
      }
    : DEFAULT_PREVIEW_DESIGN;

  return { site, design, settings: site.settings, categories: site.categories };
}

export function publishedArticles(siteId: string, limit = 50) {
  return db.article.findMany({
    where: { siteId, status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
}
