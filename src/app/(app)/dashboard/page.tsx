import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileText,
  Globe,
  Plus,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { accessibleSiteIds, getActivitySummary } from "@/lib/services/activity";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate, formatRelativeTime } from "@/lib/i18n/config";
import { PageHeader, Section, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { LinkButton } from "@/components/ui/button";
import { SiteCard } from "@/components/sites/site-card";
import { AiNotConfiguredNotice } from "@/components/shared/ai-notice";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { t, locale } = await getServerI18n();

  const siteIds = await accessibleSiteIds(user.id);
  const [summary, sites, queuedTasks, aiConfigured] = await Promise.all([
    getActivitySummary(user.id),
    siteIds.length
      ? db.site.findMany({
          where: { id: { in: siteIds } },
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { articles: true, pages: true } },
            schedule: { select: { enabled: true, nextRunAt: true, frequency: true } },
          },
        })
      : Promise.resolve([]),
    db.agentTask.findMany({
      where: { siteId: { in: siteIds }, status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { scheduledAt: "asc" },
      take: 4,
      include: { site: { select: { id: true, name: true } } },
    }),
    Boolean(process.env.MISTRAL_API_KEY),
  ]);

  const activeSites = sites.filter((site) => site.status !== "ARCHIVED");
  const autopilotOn = activeSites.filter((site) => site.autopilot !== "MANUAL").length;
  const totalArticles = activeSites.reduce((sum, site) => sum + site._count.articles, 0);

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: user.name ?? user.email })}
        description={t("dashboard.subtitle")}
        actions={
          <LinkButton href="/sites/new" variant="primary" icon={<Plus className="h-4 w-4" />}>
            {t("dashboard.newSite")}
          </LinkButton>
        }
      />

      {!aiConfigured ? <AiNotConfiguredNotice className="mb-5" /> : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.activeSites")}
          value={activeSites.length}
          icon={<Globe className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("dashboard.totalArticles")}
          value={totalArticles}
          icon={<FileText className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={t("dashboard.scheduledTasks")}
          value={summary?.queued ?? 0}
          hint={
            queuedTasks[0] ? (
              <span suppressHydrationWarning>
                {t(`activity.type.${queuedTasks[0].type}`)} ·{" "}
                {formatRelativeTime(queuedTasks[0].scheduledAt, locale)}
              </span>
            ) : (
              t("dashboard.noTasks")
            )
          }
          icon={<CalendarClock className="h-4.5 w-4.5" />}
        />
        <StatCard
          label={autopilotOn > 0 ? t("dashboard.autopilotOn") : t("dashboard.autopilotOff")}
          value={`${autopilotOn}/${activeSites.length}`}
          tone={autopilotOn > 0 ? "success" : "neutral"}
          icon={<Sparkles className="h-4.5 w-4.5" />}
        />
      </div>

      <Section
        title={t("dashboard.yourSites")}
        actions={
          <Link className="link text-sm" href="/sites">
            {t("nav.sites")} <ArrowRight className="inline h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      >
        {activeSites.length === 0 ? (
          <EmptyState
            title={t("dashboard.emptyTitle")}
            body={t("dashboard.emptyBody")}
            icon={<Globe className="h-5 w-5" />}
            action={
              <LinkButton href="/sites/new" variant="primary">
                {t("dashboard.createSite")}
              </LinkButton>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeSites.slice(0, 6).map((site) => (
              <SiteCard key={site.id} site={site} locale={locale} />
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title={t("dashboard.recentActivity")}
          actions={
            <Link className="link text-sm" href="/activity">
              {t("dashboard.viewAllActivity")}
            </Link>
          }
        >
          <ActivityMini userId={user.id} locale={locale} />
        </Section>

        <Section title={t("dashboard.nextTask")}>
          {queuedTasks.length === 0 ? (
            <EmptyState title={t("dashboard.noTasks")} body={t("schedule.tasksEmpty")} />
          ) : (
            <ul className="space-y-2">
              {queuedTasks.map((task) => (
                <li key={task.id} className="card-flat flex items-center gap-3 p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t(`activity.type.${task.type}`)}
                    </p>
                    <p className="truncate text-xs text-muted">{task.site.name}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={task.status} label={t(`schedule.taskStatus.${task.status}`)} />
                    <span className="text-xs text-faint" suppressHydrationWarning>
                      {formatRelativeTime(task.scheduledAt, locale)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

async function ActivityMini({
  userId,
  locale,
}: {
  userId: string;
  locale: "en" | "ru" | "ko";
}) {
  const { t } = await getServerI18n();
  const siteIds = await accessibleSiteIds(userId);
  if (siteIds.length === 0) {
    return <EmptyState title={t("dashboard.activityEmpty")} />;
  }
  const runs = await db.agentRun.findMany({
    where: { siteId: { in: siteIds } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      site: { select: { name: true } },
      task: { select: { type: true } },
    },
  });

  if (runs.length === 0) return <EmptyState title={t("dashboard.activityEmpty")} />;

  return (
    <ul className="space-y-2">
      {runs.map((run) => {
        const typeKey = run.task ? `activity.type.${run.task.type}` : null;
        const label = typeKey ? t(typeKey) : run.outputSummary || run.agent;
        return (
          <li key={run.id} className="card-flat flex items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{label}</p>
              <p className="truncate text-xs text-muted">
                {t(`activity.agents.${run.agent}`)} · {run.site.name}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={run.status === "SUCCESS" ? "success" : "danger"}>
                {run.status === "SUCCESS" ? t("activity.success") : t("activity.failed")}
              </Badge>
              <span className="hidden text-xs text-faint sm:inline">
                {formatDate(run.createdAt, locale, { timeStyle: "short" })}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
