import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Eye, MousePointerClick, Newspaper } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getSiteAnalytics } from "@/lib/analytics";
import { accessibleSiteIds } from "@/lib/services/activity";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/config";
import { PageHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/status";
import { TrendChart } from "@/components/charts/trend-chart";
import { RangeTabs } from "@/components/analytics/range-tabs";

export const metadata: Metadata = { title: "Analytics" };

type Search = { site?: string; range?: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { t, locale } = await getServerI18n();
  const params = await searchParams;

  const siteIds = await accessibleSiteIds(user.id);
  const sites = siteIds.length
    ? await db.site.findMany({
        where: { id: { in: siteIds }, status: { not: "ARCHIVED" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const site = sites.find((item) => item.id === params.site) ?? sites[0];

  if (!site) {
    return (
      <>
        <PageHeader title={t("analytics.title")} description={t("analytics.subtitle")} />
        <EmptyState
          title={t("sites.emptyTitle")}
          body={t("sites.emptyBody")}
          action={
            <Link href="/sites/new" className="btn btn-primary">
              {t("sites.create")}
            </Link>
          }
        />
      </>
    );
  }

  const days = params.range === "7" || params.range === "90" ? Number(params.range) : 30;
  const report = await getSiteAnalytics(site.id, days);

  const summary = report.series
    .map((point) => `${point.date}: ${point.pageViews}`)
    .slice(-14)
    .join(", ");

  return (
    <>
      <PageHeader
        title={t("analytics.title")}
        description={`${t("analytics.subtitle")} — ${site.name}`}
        actions={<RangeTabs siteId={site.id} />}
      />

      {sites.length > 1 ? (
        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label={t("nav.sites")}>
          {sites.map((item) => (
            <Link
              key={item.id}
              href={`/analytics?site=${item.id}&range=${days}`}
              className={`chip ${item.id === site.id ? "!border-accent !bg-accent !text-white" : ""}`}
              aria-current={item.id === site.id ? "page" : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {report.isDemo ? (
        <Alert tone="warning" className="mb-4">
          {t("analytics.demoNotice")}
        </Alert>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("analytics.pageViews")}
          value={formatNumber(report.totals.pageViews, locale)}
          icon={<Eye className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("analytics.visits")}
          value={formatNumber(report.totals.visits, locale)}
          icon={<MousePointerClick className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("analytics.articles")}
          value={formatNumber(report.totals.articlesPublished, locale)}
          tone="success"
          icon={<Newspaper className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("analytics.provider")}
          value={report.isDemo ? t("common.demo") : t("analytics.internal")}
          tone={report.isDemo ? "warning" : "accent"}
          icon={<BarChart3 className="h-4.5 w-4.5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
              {t("analytics.trend")}
            </h2>
            <Badge tone={report.isDemo ? "warning" : "success"}>
              {report.isDemo ? t("common.demoBadge") : t("analytics.internal")}
            </Badge>
          </div>
          {report.series.every((point) => point.pageViews === 0) ? (
            <EmptyState title={t("analytics.noData")} />
          ) : (
            <div className="text-accent">
              <TrendChart
                series={report.series}
                locale={locale}
                label={t("analytics.pageViews")}
                ariaSummary={`${t("analytics.pageViews")}: ${report.totals.pageViews}. ${summary}`}
              />
            </div>
          )}
          <ul className="mt-3 flex justify-between text-xs text-faint">
            <li>{t(`analytics.range.${days}`)}</li>
            <li>
              {t("analytics.pageViews")}: {formatNumber(report.totals.pageViews, locale)}
            </li>
          </ul>
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
            {t("analytics.topPages")}
          </h2>
          {report.topPages.length === 0 ? (
            <EmptyState title={t("analytics.noData")} />
          ) : (
            <ol className="space-y-2.5">
              {report.topPages.map((page, index) => (
                <li key={page.path} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-xs text-faint tabular">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{page.label}</p>
                    <p className="truncate text-xs text-muted">{page.path}</p>
                  </div>
                  <span className="shrink-0 text-sm tabular text-muted">
                    {formatNumber(page.pageViews, locale)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4 border-t border-line pt-3 text-xs text-faint">
            {t("analytics.trend")}
          </div>
        </div>
      </div>
    </>
  );
}
