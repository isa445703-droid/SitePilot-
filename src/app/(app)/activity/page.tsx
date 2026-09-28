import type { Metadata } from "next";
import { Activity, Clock, Sparkles, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import {
  accessibleSiteIds,
  getActivitySummary,
  listRuns,
} from "@/lib/services/activity";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate, formatRelativeTime } from "@/lib/i18n/config";
import { PageHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SkeletonList } from "@/components/ui/status";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { Suspense } from "react";

export const metadata: Metadata = { title: "AI Activity" };

type Search = { site?: string; agent?: string; status?: string };

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const { t, locale } = await getServerI18n();
  const filters = await searchParams;

  const siteIds = await accessibleSiteIds(user.id);
  const [runs, summary, sites] = await Promise.all([
    listRuns(user.id, {
      siteId: filters.site,
      agent: filters.agent,
      status: filters.status === "FAILED" || filters.status === "SUCCESS" ? filters.status : undefined,
      take: 100,
    }),
    getActivitySummary(user.id, filters.site),
    db.site.findMany({
      where: { id: { in: siteIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader title={t("activity.title")} description={t("activity.subtitle")} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("activity.log")} value={summary?.runs ?? 0} icon={<Activity className="h-4.5 w-4.5" />} />
        <StatCard
          label={t("activity.failed")}
          value={summary?.failed ?? 0}
          tone={summary?.failed ? "danger" : "neutral"}
          icon={<Zap className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("schedule.queued")}
          value={summary?.queued ?? 0}
          tone="accent"
          icon={<Clock className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("activity.tokens")}
          value={summary?.tokens ?? 0}
          icon={<Sparkles className="h-4.5 w-4.5" />}
        />
      </div>

      <Suspense fallback={<SkeletonList rows={3} />}>
        <ActivityFilters sites={sites} />
      </Suspense>

      {runs.length === 0 ? (
        <EmptyState
          title={t("activity.emptyTitle")}
          body={t("activity.emptyBody")}
          icon={<Activity className="h-5 w-5" />}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="card hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("activity.task")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("activity.agent")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("nav.sites")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("common.status")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("activity.tokens")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("activity.duration")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((run) => (
                  <tr key={run.id} className="align-top transition hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {run.task ? t(`activity.type.${run.task.type}`) : run.outputSummary || "—"}
                      </p>
                      <p className="truncate text-xs text-muted">{run.outputSummary}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone="accent">{t(`activity.agents.${run.agent}`)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{run.site.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={run.status === "SUCCESS" ? "success" : "danger"}>
                        {run.status === "SUCCESS" ? t("activity.success") : t("activity.failed")}
                      </Badge>
                      {run.isDemo ? (
                        <span className="mt-1 block">
                          <Badge>{t("activity.demoRun")}</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end tabular text-muted">
                      {run.promptTokens + run.outputTokens}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end tabular text-muted">
                      {run.durationMs} ms
                      <span className="block text-xs text-faint" suppressHydrationWarning>
                        {formatRelativeTime(run.createdAt, locale)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <ul className="space-y-2.5 lg:hidden">
            {runs.map((run) => (
              <li key={run.id} className="card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium">
                    {run.task ? t(`activity.type.${run.task.type}`) : run.outputSummary || "—"}
                  </p>
                  <Badge tone={run.status === "SUCCESS" ? "success" : "danger"}>
                    {run.status === "SUCCESS" ? t("activity.success") : t("activity.failed")}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{run.outputSummary}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                  <div>
                    <dt className="inline font-medium">{t("activity.agent")}: </dt>
                    <dd className="inline">{t(`activity.agents.${run.agent}`)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">{t("nav.sites")}: </dt>
                    <dd className="inline">{run.site.name}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">{t("activity.tokens")}: </dt>
                    <dd className="inline tabular">{run.promptTokens + run.outputTokens}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">{t("activity.duration")}: </dt>
                    <dd className="inline tabular">{run.durationMs} ms</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-faint">{formatDate(run.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
