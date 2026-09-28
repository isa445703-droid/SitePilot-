import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { handleApi, readJson, requireApiUser } from "@/lib/api/http";
import { getOwnedSite } from "@/lib/auth/guards";
import { computeNextRun, nextValidTimezone, articlesPerWeek } from "@/lib/scheduler";

type Params = { params: Promise<{ siteId: string }> };

/** GET /api/sites/:siteId/schedule — current schedule + next run + tasks. */
export async function GET(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    const [schedule, tasks] = await Promise.all([
      db.publishingSchedule.findUnique({ where: { siteId } }),
      db.agentTask.findMany({
        where: { siteId },
        orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
        take: 50,
      }),
    ]);

    return {
      site: {
        id: site.id,
        autopilot: site.autopilot,
        frequency: site.frequency,
        timezone: site.timezone,
        publishHour: site.publishHour,
      },
      schedule,
      tasks,
      perWeek: articlesPerWeek((schedule?.frequency ?? site.frequency) as never),
      previewNextRun: schedule?.nextRunAt ?? null,
    };
  });
}

const scheduleSchema = z.object({
  frequency: z.enum(["ONCE_A_WEEK", "TWICE_A_WEEK", "THREE_A_WEEK", "FIVE_A_WEEK", "DAILY"]).optional(),
  timezone: z.string().max(64).optional(),
  publishHour: z.number().int().min(0).max(23).optional(),
  enabled: z.boolean().optional(),
});

/** POST /api/sites/:siteId/schedule — update cadence settings. */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    const input = scheduleSchema.parse(await readJson(req));
    const timezone = nextValidTimezone(input.timezone ?? site.timezone);
    const frequency = input.frequency ?? site.frequency;
    const publishHour = input.publishHour ?? site.publishHour;

    const enabled = input.enabled ?? site.autopilot !== "MANUAL";
    const nextRunAt = enabled
      ? computeNextRun(frequency, { hour: publishHour, timezone })
      : null;

    const schedule = await db.publishingSchedule.upsert({
      where: { siteId },
      create: { siteId, frequency, timezone, publishHour, enabled, nextRunAt },
      update: { frequency, timezone, publishHour, enabled, nextRunAt },
    });

    if (input.frequency || input.timezone || input.publishHour !== undefined) {
      await db.site.update({
        where: { id: siteId },
        data: { frequency, timezone, publishHour },
      });
    }

    return { schedule };
  });
}
