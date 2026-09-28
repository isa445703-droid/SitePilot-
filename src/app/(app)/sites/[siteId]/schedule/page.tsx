import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { ScheduleManager, type TaskRow } from "@/components/schedule/schedule-manager";

export const metadata: Metadata = { title: "Schedule" };

type Params = { params: Promise<{ siteId: string }> };

export default async function SiteSchedulePage({ params }: Params) {
  const user = await requireUser();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, user.id);
  if (!site) notFound();

  const { t } = await getServerI18n();

  const [schedule, tasks] = await Promise.all([
    db.publishingSchedule.findUnique({ where: { siteId } }),
    db.agentTask.findMany({
      where: { siteId },
      orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
      take: 30,
    }),
  ]);

  const taskRows: TaskRow[] = tasks.map((task) => ({
    id: task.id,
    type: task.type,
    status: task.status,
    scheduledAt: task.scheduledAt.toISOString(),
    error: task.error,
  }));

  return (
    <>
      <PageHeader title={t("schedule.title")} description={t("schedule.subtitle")} />
      <ScheduleManager
        siteId={site.id}
        site={{
          id: site.id,
          autopilot: site.autopilot,
          frequency: site.frequency,
          timezone: site.timezone,
          publishHour: site.publishHour,
          name: site.name,
        }}
        schedule={
          schedule
            ? {
                enabled: schedule.enabled,
                nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
                frequency: schedule.frequency,
                timezone: schedule.timezone,
                publishHour: schedule.publishHour,
              }
            : null
        }
        tasks={taskRows}
      />
    </>
  );
}
