import "server-only";
import { db } from "@/lib/db/prisma";

/**
 * Analytics abstraction.
 *
 * - `InternalAnalyticsProvider` reads real page-view rows recorded by the app.
 * - Development-only demo data is generated when nothing has been measured yet,
 *   and every demo row is stored with `source = "demo"` so the UI can label it.
 *   In production, missing data is simply reported as zero — nothing is invented.
 */

export type AnalyticsPoint = {
  date: string;
  pageViews: number;
  visits: number;
};

export type TopPage = {
  label: string;
  path: string;
  pageViews: number;
  isArticle: boolean;
};

export type AnalyticsReport = {
  provider: "internal" | "demo";
  isDemo: boolean;
  series: AnalyticsPoint[];
  topPages: TopPage[];
  totals: { pageViews: number; visits: number; articlesPublished: number };
  rangeDays: number;
};

export interface AnalyticsProvider {
  readonly name: string;
  report(siteId: string, days: number): Promise<AnalyticsReport>;
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dateKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Deterministic pseudo-random series for development demo data. */
function demoSeries(siteId: string, days: number): AnalyticsPoint[] {
  const seed = hashString(siteId);
  const points: AnalyticsPoint[] = [];
  const today = dateKey(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86_400_000);
    const n = hashString(`${siteId}:${date.toISOString().slice(0, 10)}:${seed}`);
    const weekly = [0.8, 1.0, 1.1, 1.25, 1.4, 1.15, 0.9][date.getUTCDay()];
    const growth = 1 + (days - i) / (days * 3);
    const pageViews = Math.round((((n % 400) + 60) / 10) * weekly * growth);
    points.push({
      date: date.toISOString().slice(0, 10),
      pageViews,
      visits: Math.max(1, Math.round(pageViews / (2.5 + ((n % 10) / 10)))),
    });
  }
  return points;
}

export class InternalAnalyticsProvider implements AnalyticsProvider {
  readonly name = "internal";

  async report(siteId: string, days: number): Promise<AnalyticsReport> {
    const since = new Date(dateKey(new Date()).getTime() - (days - 1) * 86_400_000);
    const [rows, articles] = await Promise.all([
      db.analyticsDaily.findMany({
        where: { siteId, date: { gte: since } },
        orderBy: { date: "asc" },
        include: { article: { select: { title: true, slug: true } } },
      }),
      db.article.count({ where: { siteId, status: "PUBLISHED" } }),
    ]);

    const internalRows = rows.filter((r) => r.source === "internal");
    const useInternal = internalRows.length > 0;

    const byDate = new Map<string, AnalyticsPoint>();
    for (const row of useInternal ? internalRows : rows) {
      const key = row.date.toISOString().slice(0, 10);
      const point = byDate.get(key) ?? { date: key, pageViews: 0, visits: 0 };
      point.pageViews += row.pageViews;
      point.visits += row.visits;
      byDate.set(key, point);
    }

    const series: AnalyticsPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dateKey(new Date(Date.now() - i * 86_400_000)).toISOString().slice(0, 10);
      series.push(byDate.get(key) ?? { date: key, pageViews: 0, visits: 0 });
    }

    const totalsByPath = new Map<string, TopPage>();
    for (const row of useInternal ? internalRows : rows) {
      const label = row.article?.title ?? (row.articleId ? "Article" : "Home / index");
      const path = row.article ? `/a/${row.article.slug}` : "/";
      const entry = totalsByPath.get(path) ?? { label, path, pageViews: 0, isArticle: Boolean(row.article) };
      entry.pageViews += row.pageViews;
      totalsByPath.set(path, entry);
    }

    const topPages = [...totalsByPath.values()].sort((a, b) => b.pageViews - a.pageViews).slice(0, 8);
    const isDemo = !useInternal && rows.length > 0 && rows.every((r) => r.source === "demo");

    return {
      provider: useInternal ? "internal" : isDemo ? "demo" : "internal",
      isDemo,
      series,
      topPages,
      totals: {
        pageViews: series.reduce((s, p) => s + p.pageViews, 0),
        visits: series.reduce((s, p) => s + p.visits, 0),
        articlesPublished: articles,
      },
      rangeDays: days,
    };
  }
}

export const analyticsProvider: AnalyticsProvider = new InternalAnalyticsProvider();

export function isDemoAnalyticsAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Persists deterministic demo rows (development only) if nothing exists yet. */
export async function ensureDemoAnalytics(siteId: string, publishedCount: number): Promise<void> {
  if (!isDemoAnalyticsAllowed()) return;

  const existing = await db.analyticsDaily.count({ where: { siteId } });
  if (existing > 0) return;

  const points = demoSeries(siteId, 30);
  for (const point of points) {
    await db.analyticsDaily.create({
      data: {
        siteId,
        date: new Date(`${point.date}T00:00:00.000Z`),
        pageViews: point.pageViews,
        visits: point.visits,
        source: "demo",
      },
    });
  }

  if (publishedCount > 0) {
    const articles = await db.article.findMany({
      where: { siteId, status: "PUBLISHED" },
      select: { id: true, slug: true },
      take: 8,
    });
    for (const [index, article] of articles.entries()) {
      for (const point of points.slice(-14)) {
        const views = Math.max(1, Math.round((point.pageViews / (index + 2)) * (0.5 + ((index * 7) % 5) / 5)));
        await db.analyticsDaily.create({
          data: {
            siteId,
            articleId: article.id,
            date: new Date(`${point.date}T00:00:00.000Z`),
            pageViews: views,
            visits: Math.max(1, Math.round(views / 3)),
            source: "demo",
          },
        });
      }
    }
  }
}

export async function getSiteAnalytics(siteId: string, days: number): Promise<AnalyticsReport> {
  const rows = await db.analyticsDaily.count({ where: { siteId, source: "internal" } });
  if (rows === 0) {
    const published = await db.article.count({ where: { siteId, status: "PUBLISHED" } });
    await ensureDemoAnalytics(siteId, published);
  }
  const report = await analyticsProvider.report(siteId, days);
  if (report.isDemo && !isDemoAnalyticsAllowed()) {
    return { ...report, isDemo: false, series: [], topPages: [], totals: { ...report.totals, pageViews: 0, visits: 0 } };
  }
  return report;
}

/** Records a real page view (called after the preview response is sent). */
export async function recordPageView(siteId: string, articleId?: string | null): Promise<void> {
  const today = dateKey(new Date());
  try {
    const existing = await db.analyticsDaily.findFirst({
      where: { siteId, articleId: articleId ?? null, date: today, source: "internal" },
    });
    if (existing) {
      await db.analyticsDaily.update({
        where: { id: existing.id },
        data: { pageViews: { increment: 1 }, visits: { increment: 1 } },
      });
    } else {
      await db.analyticsDaily.create({
        data: {
          siteId,
          articleId: articleId ?? null,
          date: today,
          pageViews: 1,
          visits: 1,
          source: "internal",
        },
      });
    }
  } catch {
    // Analytics must never break rendering.
  }
}
