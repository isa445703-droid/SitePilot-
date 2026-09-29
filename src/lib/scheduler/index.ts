import "server-only";
import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { MAX_TASK_ATTEMPTS, STALE_TASK_MS, PermanentTaskError } from "@/lib/agents/task-policy";
import type { PublishingFrequency } from "@prisma/client";

/**
 * Publishing scheduler + autopilot.
 *
 * - `computeNextRun` is a pure (testable) function: next slot for a frequency
 *   in a specific IANA timezone, honouring DST.
 * - Autopilot creates real AgentTasks: MANUAL = nothing, REVIEW = tasks produce
 *   articles that wait for approval, FULL = tasks publish automatically.
 */

export const FREQUENCY_DAYS: Record<PublishingFrequency, number[]> = {
  ONCE_A_WEEK: [1],
  TWICE_A_WEEK: [1, 4],
  THREE_A_WEEK: [1, 3, 5],
  FIVE_A_WEEK: [1, 2, 3, 4, 5],
  DAILY: [0, 1, 2, 3, 4, 5, 6],
};

export const FREQUENCY_ORDER: PublishingFrequency[] = [
  "ONCE_A_WEEK",
  "TWICE_A_WEEK",
  "THREE_A_WEEK",
  "FIVE_A_WEEK",
  "DAILY",
];

export function articlesPerWeek(frequency: PublishingFrequency): number {
  return (FREQUENCY_DAYS[frequency] ?? FREQUENCY_DAYS.THREE_A_WEEK).length;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

function offsetMs(utcMs: number, timeZone: string): number {
  const p = zonedParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - utcMs;
}

/** UTC instant of `hour:00` on the given calendar date in `timeZone`. */
export function utcFromZoned(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, 0, 0);
  let utc = target - offsetMs(target, timeZone);
  utc = target - offsetMs(utc, timeZone);
  return new Date(utc);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function nextValidTimezone(timeZone?: string | null): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
}

/**
 * Next publication slot strictly after `from` for the given frequency,
 * weekday set and local publishing hour.
 */
export function computeNextRun(
  frequency: PublishingFrequency,
  options: { hour?: number; timezone?: string; from?: Date } = {},
): Date {
  const from = options.from ?? new Date();
  const timezone = nextValidTimezone(options.timezone);
  const hour = Math.min(23, Math.max(0, Math.floor(options.hour ?? 9)));
  const allowed = FREQUENCY_DAYS[frequency] ?? FREQUENCY_DAYS.THREE_A_WEEK;

  const local = zonedParts(from, timezone);
  for (let i = 0; i < 21; i++) {
    const calendar = new Date(Date.UTC(local.year, local.month - 1, local.day + i));
    const weekday = calendar.getUTCDay();
    if (!allowed.includes(weekday)) continue;
    const candidate = utcFromZoned(
      calendar.getUTCFullYear(),
      calendar.getUTCMonth() + 1,
      calendar.getUTCDate(),
      hour,
      timezone,
    );
    if (candidate.getTime() > from.getTime() + 30_000) return candidate;
  }
  // Unreachable for any valid frequency, but never return an invalid date.
  return new Date(from.getTime() + 7 * 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Client seam (allows unit tests to pass a stub)                             */
/* -------------------------------------------------------------------------- */

export type SchedulerClient = {
  site: { findUnique: (args: any) => Promise<any | null>; update: (args: any) => Promise<any> };
  publishingSchedule: {
    upsert: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  agentTask: {
    create: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
    findFirst: (args: any) => Promise<any | null>;
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<{ count: number }>;
  };
  /**
   * Present on the real Prisma client, absent on the hermetic test stubs —
   * used to make the queue's "is it empty?" + "create" pair atomic.
   */
  $transaction?: <T>(fn: (tx: SchedulerClient) => Promise<T>) => Promise<T>;
  $queryRaw?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/**
 * Serialises the queue check and the create it guards, per site.
 *
 * A scheduler tick and an API-triggered run could both count zero pending
 * `GENERATE_ARTICLE` tasks and both queue the autopilot's next article. Taking a
 * row lock on the site for the length of the transaction makes the pair atomic:
 * the loser of the race waits, then sees the task the winner just created.
 *
 * Clients without `$transaction` (the test stubs) simply run the body inline —
 * they have no concurrency to lose a race to.
 */
async function withSiteQueueLock<T>(
  client: SchedulerClient,
  siteId: string,
  body: (scoped: SchedulerClient) => Promise<T>,
): Promise<T> {
  if (typeof client.$transaction !== "function") return body(client);
  return client.$transaction(async (scoped) => {
    if (typeof scoped.$queryRaw === "function") {
      // Held until commit — see the comment above.
      await scoped.$queryRaw`SELECT id FROM "Site" WHERE id = ${siteId} FOR UPDATE`;
    }
    return body(scoped);
  });
}

/* -------------------------------------------------------------------------- */
/* Autopilot                                                                  */
/* -------------------------------------------------------------------------- */

export type AutopilotMode = "MANUAL" | "REVIEW" | "FULL";

export type AutopilotResult = {
  mode: AutopilotMode;
  enabled: boolean;
  nextRunAt: Date | null;
  taskId: string | null;
};

export async function enableAutopilot(
  siteId: string,
  mode: AutopilotMode,
  client: SchedulerClient = db as unknown as SchedulerClient,
): Promise<AutopilotResult> {
  if (mode === "MANUAL") {
    await client.site.update({ where: { id: siteId }, data: { autopilot: "MANUAL" } });
    await client.agentTask.updateMany({
      where: { siteId, status: "QUEUED", type: "GENERATE_ARTICLE" },
      data: { status: "CANCELLED" },
    });
    await client.publishingSchedule.upsert({
      where: { siteId },
      create: { siteId, enabled: false },
      update: { enabled: false, nextRunAt: null },
    });
    return { mode: "MANUAL", enabled: false, nextRunAt: null, taskId: null };
  }

  const site = await client.site.findUnique({
    where: { id: siteId },
    include: { schedule: true },
  });
  if (!site) throw new PermanentTaskError("Site not found", 404);

  const timezone = nextValidTimezone(site.timezone);
  const publishHour = site.publishHour ?? 9;
  const frequency = (site.schedule?.frequency ?? site.frequency ?? "THREE_A_WEEK") as PublishingFrequency;

  await client.site.update({ where: { id: siteId }, data: { autopilot: mode } });

  const nextRunAt = computeNextRun(frequency, { hour: publishHour, timezone });
  await client.publishingSchedule.upsert({
    where: { siteId },
    create: {
      siteId,
      frequency,
      timezone,
      publishHour,
      enabled: true,
      lastRunAt: null,
      nextRunAt,
    },
    update: { enabled: true, timezone, publishHour, nextRunAt },
  });

  // A real queued task proves the loop is running — MANUAL never gets one.
  // Checked under the site lock so a concurrent tick cannot queue a second one.
  const task = await withSiteQueueLock(client, siteId, async (scoped) => {
    const existing = await scoped.agentTask.findFirst({
      where: { siteId, type: "GENERATE_ARTICLE", status: "QUEUED" },
    });
    if (existing) return existing;
    return scoped.agentTask.create({
      data: {
        siteId,
        type: "GENERATE_ARTICLE",
        status: "QUEUED",
        scheduledAt: nextRunAt,
        priority: 50,
        input: {
          title: pickNextTitle(site),
          category: "",
          keywords: [],
          research: true,
        },
      },
    });
  });

  return { mode, enabled: true, nextRunAt, taskId: task.id };
}

export async function disableAutopilot(
  siteId: string,
  client: SchedulerClient = db as unknown as SchedulerClient,
): Promise<AutopilotResult> {
  await client.site.update({ where: { id: siteId }, data: { autopilot: "MANUAL" } });
  await client.publishingSchedule.upsert({
    where: { siteId },
    create: { siteId, enabled: false },
    update: { enabled: false, nextRunAt: null },
  });
  // Keep running work, but nothing new waits in the queue.
  await client.agentTask.updateMany({
    where: { siteId, status: "QUEUED", type: "GENERATE_ARTICLE" },
    data: { status: "CANCELLED" },
  });
  return { mode: "MANUAL", enabled: false, nextRunAt: null, taskId: null };
}

const FALLBACK_TITLES = [
  "Getting started: what matters most",
  "A practical checklist for beginners",
  "Common questions answered",
  "How to plan the next 90 days",
  "Mistakes to avoid and what to do instead",
];

function pickNextTitle(site: { name: string; blueprint?: unknown }): string {
  const seed = (site.name || "article").toLowerCase();
  const index = Math.abs(hash(seed)) % FALLBACK_TITLES.length;
  return FALLBACK_TITLES[index];
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}

/**
 * Queues the next GENERATE_ARTICLE task for a site and stores `nextRunAt`.
 * Returns null when autopilot is off or a task is already waiting.
 */
export async function scheduleNextPublication(
  siteId: string,
  client: SchedulerClient = db as unknown as SchedulerClient,
): Promise<{ taskId: string; runAt: Date } | null> {
  const site = await client.site.findUnique({
    where: { id: siteId },
    include: { schedule: true },
  });
  if (!site?.schedule?.enabled || site.autopilot === "MANUAL") return null;

  const frequency = (site.schedule.frequency ?? site.frequency) as PublishingFrequency;
  const runAt = computeNextRun(frequency, {
    hour: site.schedule.publishHour ?? site.publishHour ?? 9,
    timezone: nextValidTimezone(site.schedule.timezone ?? site.timezone),
  });

  // Count + create must be atomic, otherwise two runners each queue the next
  // autopilot article and the site silently publishes twice as often.
  const task = await withSiteQueueLock(client, siteId, async (scoped) => {
    const queued = await scoped.agentTask.count({
      where: { siteId, type: "GENERATE_ARTICLE", status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (queued > 0) return null;

    const created = await scoped.agentTask.create({
      data: {
        siteId,
        type: "GENERATE_ARTICLE",
        status: "QUEUED",
        scheduledAt: runAt,
        priority: 50,
        input: { title: pickNextTitle(site), category: "", keywords: [], research: true },
      },
    });

    await scoped.publishingSchedule.update({
      where: { siteId },
      data: { nextRunAt: runAt },
    });

    return created;
  });

  if (!task) return null;
  return { taskId: task.id, runAt };
}

/* -------------------------------------------------------------------------- */
/* Tick loop                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `skipped` counts claims we lost to a concurrent runner — visible for
 * diagnostics, but not a failure of this tick.
 */
export type TickResult = { ran: number; completed: number; failed: number; skipped: number };

/**
 * Runs every queued task whose scheduled time has passed.
 *
 * Two things keep the queue fair:
 * - the deadline is applied in SQL, so a backlog of future work cannot fill
 *   the candidate window and starve the tasks that are due right now;
 * - candidates are spread across sites first, so a site with a deep backlog
 *   cannot take the whole tick while every other site waits.
 */
export async function runDueTasks(limit = 5): Promise<TickResult> {
  // Dynamic import keeps the module graph acyclic (orchestrator imports us).
  const { runTask } = await import("@/lib/agents/orchestrator");

  const now = Date.now();
  const candidates = await db.agentTask.findMany({
    // `scheduledAt` is NOT NULL (schema default `now()`), so the deadline is a
    // plain range scan on AgentTask_status_scheduledAt — no post-filter has to
    // throw future work away after it was fetched.
    where: { status: "QUEUED", scheduledAt: { lte: new Date(now) } },
    orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
    take: limit * 8,
    select: { id: true, siteId: true, scheduledAt: true },
  });

  // Defensive re-check: a malformed row (or a db stub in tests) must not block
  // the queue — anything without a usable deadline counts as due here.
  const due = candidates.filter((task) => !task.scheduledAt || task.scheduledAt.getTime() <= now);

  // First pass: at most half the tick per site, so every site with queued work
  // makes progress. Second pass: the remaining slots are filled from anyone,
  // so a single-site queue still runs the full limit each tick.
  const perSiteCap = Math.max(1, Math.ceil(limit / 2));
  const picked: typeof due = [];
  const pickedIds = new Set<string>();
  const perSite = new Map<string, number>();
  for (const task of due) {
    if (picked.length >= limit) break;
    const used = perSite.get(task.siteId) ?? 0;
    if (used >= perSiteCap) continue;
    perSite.set(task.siteId, used + 1);
    picked.push(task);
    pickedIds.add(task.id);
  }
  for (const task of due) {
    if (picked.length >= limit) break;
    if (pickedIds.has(task.id)) continue;
    picked.push(task);
  }

  const result: TickResult = { ran: 0, completed: 0, failed: 0, skipped: 0 };
  for (const task of picked) {
    result.ran++;
    const outcome = await runTask(task.id);
    if (outcome.ok) result.completed++;
    else if (outcome.skipped) result.skipped++;
    else result.failed++;
  }
  return result;
}

/** Fills the queue for sites whose autopilot is on but has nothing waiting. */
export async function ensureSchedules(): Promise<number> {
  const sites = await db.site.findMany({
    where: { autopilot: { in: ["REVIEW", "FULL"] }, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  let created = 0;
  for (const site of sites) {
    const taskId = await scheduleNextPublication(site.id);
    if (taskId) created++;
  }
  return created;
}

/**
 * A crash mid-run leaves a task in RUNNING forever. This puts stale tasks back
 * into the queue — unless they already used up their attempts, in which case
 * they are failed so a poison task can never loop.
 */
export async function recoverStuckTasks(
  staleMs: number = STALE_TASK_MS,
  client: SchedulerClient = db as unknown as SchedulerClient,
): Promise<{ requeued: number; failed: number }> {
  const cutoff = new Date(Date.now() - staleMs);
  const stuck = await client.agentTask.findMany({
    where: { status: "RUNNING", OR: [{ startedAt: { lte: cutoff } }, { startedAt: null }] },
    orderBy: { startedAt: "asc" },
    take: 50,
  });

  const result = { requeued: 0, failed: 0 };
  for (const task of stuck) {
    const attempts = task.attempts ?? 0;
    if (attempts >= MAX_TASK_ATTEMPTS) {
      await client.agentTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: "Task stalled while running and ran out of attempts.",
        },
      });
      result.failed++;
    } else {
      await client.agentTask.update({
        where: { id: task.id },
        data: {
          status: "QUEUED",
          scheduledAt: new Date(),
          error: "Task stalled while running; requeued automatically.",
        },
      });
      result.requeued++;
    }
  }

  if (result.requeued + result.failed > 0) {
    logger.warn("stale_tasks_recovered", result as unknown as Record<string, unknown>);
  }
  return result;
}

/** Expired session rows are dropped once per tick instead of on every request. */
async function purgeExpiredSessionsOnce(): Promise<void> {
  const { purgeExpiredSessions } = await import("@/lib/auth/session");
  const purged = await purgeExpiredSessions();
  if (purged > 0) logger.info("sessions_purged", { count: purged });
}

export async function schedulerTick(): Promise<TickResult> {
  // One tick at a time. Article generation takes 40-80s while the interval
  // fires every 60s, so without this guard an in-flight tick raced the next one
  // (double recovery work, tasks stolen mid-selection, a bogus `failed` count).
  const g = globalThis as unknown as { __sitepilotTicking?: boolean };
  if (g.__sitepilotTicking) {
    logger.debug("scheduler_tick_skipped", { reason: "already_running" });
    return { ran: 0, completed: 0, failed: 0, skipped: 0 };
  }
  g.__sitepilotTicking = true;

  try {
    try {
      await recoverStuckTasks();
      await purgeExpiredSessionsOnce();
      await ensureSchedules();
      const result = await runDueTasks();
      if (result.ran > 0) logger.info("scheduler_tick", result as unknown as Record<string, unknown>);
      return result;
    } catch (error) {
      logger.error("scheduler_tick_failed", { error: String(error) });
      return { ran: 0, completed: 0, failed: 1, skipped: 0 };
    }
  } finally {
    g.__sitepilotTicking = false;
  }
}

/** Starts the in-process loop (guarded against HMR double-starts). */
export function startSchedulerLoop(intervalMs = 60_000): void {
  const g = globalThis as unknown as { __sitepilotScheduler?: NodeJS.Timeout };
  if (g.__sitepilotScheduler) return;
  if (process.env.DISABLE_SCHEDULER === "1") return;
  void schedulerTick();
  g.__sitepilotScheduler = setInterval(() => {
    void schedulerTick();
  }, intervalMs);
  if (typeof g.__sitepilotScheduler.unref === "function") g.__sitepilotScheduler.unref();
}

export function stopSchedulerLoop(): void {
  const g = globalThis as unknown as { __sitepilotScheduler?: NodeJS.Timeout };
  if (g.__sitepilotScheduler) {
    clearInterval(g.__sitepilotScheduler);
    g.__sitepilotScheduler = undefined;
  }
}
