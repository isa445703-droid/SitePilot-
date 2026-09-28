import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { accessibleSiteIds } from "@/lib/services/activity";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/config";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { LinkButton } from "@/components/ui/button";
import { AutopilotSwitch } from "@/components/schedule/autopilot-switch";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const user = await requireUser();
  const { t, locale } = await getServerI18n();

  const siteIds = await accessibleSiteIds(user.id);
  const sites = siteIds.length
    ? await db.site.findMany({
        where: { id: { in: siteIds }, status: { not: "ARCHIVED" } },
        orderBy: { name: "asc" },
        include: { schedule: true, _count: { select: { tasks: true } } },
      })
    : [];

  return (
    <>
      <PageHeader title={t("schedule.title")} description={t("schedule.subtitle")} />

      <p className="mb-4 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-xs text-muted">
        {t("schedule.autoloop")}
      </p>

      {sites.length === 0 ? (
        <EmptyState
          title={t("sites.emptyTitle")}
          body={t("sites.emptyBody")}
          action={
            <LinkButton href="/sites/new" variant="primary">
              {t("sites.create")}
            </LinkButton>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sites.map((site) => (
            <li key={site.id} className="card p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/sites/${site.id}`} className="truncate text-base font-semibold hover:text-accent">
                      {site.name}
                    </Link>
                    <Badge tone={site.autopilot === "MANUAL" ? "neutral" : "success"}>
                      {t(`sites.autopilot.${site.autopilot}`)}
                    </Badge>
                    <Badge>{t(`schedule.frequencies.${site.schedule?.frequency ?? site.frequency}`)}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("schedule.nextRun")}:{" "}
                      {site.schedule?.nextRunAt
                        ? formatDate(site.schedule.nextRunAt, locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : t("common.never")}
                    </span>
                    <span>
                      {t("schedule.tasks")}: {site._count.tasks}
                    </span>
                    <span>
                      {t("schedule.timezone")}: {site.schedule?.timezone ?? site.timezone}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <AutopilotSwitch siteId={site.id} value={site.autopilot} />
                  <LinkButton href={`/sites/${site.id}/schedule`} size="sm" variant="ghost">
                    {t("site.tabs.schedule")}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </LinkButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
