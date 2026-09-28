import "server-only";
import { db } from "@/lib/db/prisma";

export type PreviewDesign = {
  primaryColor: string;
  secondaryColor: string;
  surfaceColor: string;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
  fontStyle: string;
  layoutStyle: string;
  cardStyle: string;
  borderRadius: number;
  headerStyle: string;
  heroStyle: string;
  cardDensity: string;
};

export const DEFAULT_PREVIEW_DESIGN: PreviewDesign = {
  primaryColor: "#2563eb",
  secondaryColor: "#0f172a",
  surfaceColor: "#ffffff",
  backgroundColor: "#f7f8fa",
  textColor: "#0f172a",
  mutedColor: "#475569",
  fontStyle: "modern",
  layoutStyle: "centered",
  cardStyle: "soft",
  borderRadius: 12,
  headerStyle: "plain",
  heroStyle: "banded",
  cardDensity: "comfortable",
};

function enumOr<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function radiusOr(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_PREVIEW_DESIGN.borderRadius;
  return Math.min(32, Math.max(0, Math.round(value)));
}

/**
 * Turns a stored SiteDesign row into render tokens. Rows written before the
 * design system was extended fall back field by field, so an old site keeps
 * rendering instead of losing its identity after a deploy.
 */
export function normalizeDesign(row: Record<string, unknown> | null): PreviewDesign {
  if (!row) return DEFAULT_PREVIEW_DESIGN;

  const text = typeof row.textColor === "string" ? row.textColor : DEFAULT_PREVIEW_DESIGN.textColor;
  const storedBackground =
    typeof row.backgroundColor === "string" && row.backgroundColor
      ? row.backgroundColor
      : DEFAULT_PREVIEW_DESIGN.backgroundColor;

  // Rows written before the palette was split used backgroundColor as the whole
  // page colour. Translate them once so an existing site keeps looking the way
  // its owner designed it, then treat the result as a normal token set.
  const legacy = !row.surfaceColor;
  const legacyDark = legacy && isDarkColor(storedBackground);
  const surfaceColor = legacy ? (legacyDark ? storedBackground : "#ffffff") : String(row.surfaceColor);
  const backgroundColor = legacy
    ? legacyDark
      ? "#0b1220"
      : "#f7f8fa"
    : storedBackground;
  const mutedColor = legacy
    ? legacyDark
      ? "#94a3b8"
      : "#475569"
    : typeof row.mutedColor === "string" && row.mutedColor
      ? row.mutedColor
      : deriveMuted(text, isDarkColor(surfaceColor));

  return {
    primaryColor: typeof row.primaryColor === "string" ? row.primaryColor : DEFAULT_PREVIEW_DESIGN.primaryColor,
    secondaryColor:
      typeof row.secondaryColor === "string" ? row.secondaryColor : DEFAULT_PREVIEW_DESIGN.secondaryColor,
    surfaceColor,
    backgroundColor,
    textColor: text,
    mutedColor,
    fontStyle: enumOr(row.fontStyle as string, ["modern", "classic", "editorial"], "modern"),
    layoutStyle: enumOr(row.layoutStyle as string, ["centered", "wide", "magazine"], "centered"),
    cardStyle: enumOr(row.cardStyle as string, ["soft", "flat", "outlined"], "soft"),
    borderRadius: radiusOr(row.borderRadius as number),
    headerStyle: enumOr(row.headerStyle as string, ["plain", "brand", "gradient"], "plain"),
    heroStyle: enumOr(row.heroStyle as string, ["simple", "banded", "centered"], "banded"),
    cardDensity: enumOr(row.cardDensity as string, ["compact", "comfortable"], "comfortable"),
  };
}

function isDarkColor(hex: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return false;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.45;
}

function deriveMuted(text: string, dark: boolean): string {
  return dark ? "#94a3b8" : "#475569";
}

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

  const design = normalizeDesign(site.design as unknown as Record<string, unknown> | null);

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
