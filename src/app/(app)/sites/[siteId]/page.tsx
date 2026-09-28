import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Eye,
  FileText,
  Globe,
  Radio,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getSiteOverview } from "@/lib/services/sites";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate, formatRelativeTime } from "@/lib/i18n/config";
import { siteHref } from "@/lib/site-url";
import { Card, CardBody, CardHeader, KeyValues, PageHeader, Section, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { LinkButton } from "@/components/ui/button";
import { SeoAuditButton } from "@/components/sites/seo-audit-button";

export const metadata: Metadata = { title: "Site" };

type Params = { params: Promise<{ siteId: string }> };

export default async function SiteOverviewPage({ params }: Params) {
  const user = await requireUser();
  const { siteId } = await params;
  const { t, locale } = await getServerI18n();

  const overview = await getSiteOverview(siteId, user.id, locale);
  if (!overview) return null;

  const { site, schedule, stats, lastRun } = overview;

  const runs = await db.agentRun.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { task: { select: { type: true } } },
  });

  const recentArticles = await db.article.findMany({
    where: { siteId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, title: true, status: true, updatedAt: true, wordCount: true, slug: true },
  });

  const health: "good" | "warn" | "bad" =
    stats.seoIssues === 0 && stats.published > 0
      ? "good"
      : stats.seoIssues > 5 || stats.published === 0
        ? "warn"
        : "good";

  return (
    <>
      <PageHeader
        title={t("site.tabs.overview")}
        description={t("dashboard.subtitle")}
        actions={
          <>
            <LinkButton href={`/sites/${siteId}/content`} size="sm">
              {t("site.viewContent")}
            </LinkButton>
            <LinkButton
              href={`/preview/${siteId}`}
              size="sm"
              variant="secondary"
              icon={<Eye className="h-4 w-4" />}
            >
              {t("nav.preview")}
            </LinkButton>
            <LinkButton
              href={siteHref(site.slug)}
              size="sm"
              variant="secondary"
              icon={<Globe className="h-4 w-4" />}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("site.openSite")}
            </LinkButton>
            <LinkButton href={`/sites/${siteId}/settings`} size="sm" variant="primary">
              {t("site.tabs.settings")}
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t("site.stats.articles")} value={stats.articles} icon={<FileText className="h-4.5 w-4.5" />} />
        <StatCard
          label={t("site.stats.published")}
          value={stats.published}
          tone="success"
          icon={<Globe className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("site.stats.scheduled")}
          value={stats.queued}
          tone="accent"
          icon={<CalendarClock className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("site.stats.seoIssues")}
          value={stats.seoIssues}
          tone={stats.seoIssues > 0 ? "warning" : "neutral"}
          icon={<ScanSearch className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("site.stats.runs")}
          value={stats.runs}
          icon={<Sparkles className="h-4.5 w-4.5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader
              title={t("site.overview.brief")}
              actions={<Badge tone={health === "good" ? "success" : "warning"}>{t(`dashboard.health.${health}`)}</Badge>}
            />
            <CardBody className="space-y-4">
              <p className="surface-2 whitespace-pre-wrap p-3 text-sm text-muted">
                {site.brief || "—"}
              </p>
              <KeyValues
                items={[
                  { label: t("site.overview.designBrief"), value: site.designBrief },
                  { label: t("site.overview.audience"), value: site.targetAudience },
                  { label: t("site.overview.goal"), value: site.primaryGoal },
                  { label: t("site.overview.tone"), value: site.tone },
                  { label: t("site.overview.language"), value: site.language.toUpperCase() },
                  { label: t("site.overview.timezone"), value: site.timezone },
                  {
                    label: t("site.overview.frequency"),
                    value: t(`schedule.frequencies.${schedule?.frequency ?? site.frequency}`),
                  },
                  {
                    label: t("schedule.nextRun"),
                    value: schedule?.nextRunAt
                      ? formatDate(schedule.nextRunAt, locale, { dateStyle: "medium", timeStyle: "short" })
                      : t("common.never"),
                  },
                  { label: t("schedule.autopilot"), value: t(`sites.autopilot.${site.autopilot}`) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("content.title")}
              actions={
                <Link className="link text-sm" href={`/sites/${siteId}/content`}>
                  {t("site.viewContent")}
                </Link>
              }
            />
            <CardBody>
              {recentArticles.length === 0 ? (
                <EmptyState title={t("content.emptyTitle")} body={t("content.emptyBody")} />
              ) : (
                <ul className="divide-y divide-line">
                  {recentArticles.map((article) => (
                    <li key={article.id} className="flex items-center gap-3 py-2.5">
                      <Link href={`/content/${article.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">
                        {article.title}
                      </Link>
                      <Badge
                        tone={
                          article.status === "PUBLISHED"
                            ? "success"
                            : article.status === "REVIEW"
                              ? "accent"
                              : "neutral"
                        }
                      >
                        {t(`editor.status.${article.status}`)}
                      </Badge>
                      <span className="hidden shrink-0 text-xs text-faint sm:inline" suppressHydrationWarning>
                        {formatRelativeTime(article.updatedAt, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t("site.recentActivity")}
              actions={
                <Link className="link text-sm" href={`/activity?site=${siteId}`}>
                  {t("nav.activity")}
                </Link>
              }
            />
            <CardBody>
              {runs.length === 0 ? (
                <EmptyState title={t("dashboard.activityEmpty")} />
              ) : (
                <ul className="space-y-2.5">
                  {runs.map((run) => (
                    <li key={run.id} className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          run.status === "SUCCESS" ? "bg-success" : "bg-danger"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {run.task
                            ? t(`activity.type.${run.task.type}`)
                            : run.outputSummary || run.agent}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {t(`activity.agents.${run.agent}`)} ·{" "}
                          <span suppressHydrationWarning>
                            {formatRelativeTime(run.createdAt, locale)}
                          </span>
                        </p>
                      </div>
                      {run.isDemo ? <Badge>{t("activity.demoRun")}</Badge> : null}
                    </li>
                  ))}
                </ul>
              )}
              {lastRun ? (
                <p className="mt-3 border-t border-line pt-3 text-xs text-faint">
                  {t("dashboard.lastActivity")}: {formatDate(lastRun.createdAt, locale)}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("dashboard.quickActions")} />
            <CardBody className="flex flex-col gap-2">
              <LinkButton href={`/sites/${siteId}/blueprint`} block>
                {t("site.tabs.blueprint")} <ArrowUpRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton href={`/sites/${siteId}/schedule`} block icon={<Radio className="h-4 w-4" />}>
                {t("site.tabs.schedule")}
              </LinkButton>
              <SeoAuditButton siteId={siteId} size="md" />
              <LinkButton href={`/analytics?site=${siteId}`} block>
                {t("nav.analytics")}
              </LinkButton>
            </CardBody>
          </Card>
        </div>
      </div>

      <Section>
        <p className="text-xs text-faint">{t("schedule.autoloop")}</p>
      </Section>
    </>
  );
}
