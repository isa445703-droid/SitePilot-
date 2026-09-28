import { describe, expect, it, vi } from "vitest";

// The scheduler takes its persistence client as an argument; mock the module
// import so no Prisma client (or database) is constructed in unit tests.
vi.mock("@/lib/db/prisma", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  articlesPerWeek,
  computeNextRun,
  disableAutopilot,
  enableAutopilot,
  isValidTimeZone,
  scheduleNextPublication,
} from "@/lib/scheduler";

function makeClient(overrides: Record<string, unknown> = {}) {
  const calls = {
    create: vi.fn(async (args: Record<string, unknown>) => ({ id: "task_1", ...args })),
    updateMany: vi.fn(async (args: Record<string, unknown>) => ({ count: 1, args })),
    update: vi.fn(async (args: Record<string, unknown>) => ({ args })),
    upsert: vi.fn(async (args: Record<string, unknown>) => ({ args })),
    findFirst: vi.fn(async (_args: Record<string, unknown>) => null),
    findUnique: vi.fn(async (_args: Record<string, unknown>) => null),
    count: vi.fn(async (_args: Record<string, unknown>) => 0),
  };

  const client = {
    site: {
      update: calls.update,
      findUnique: vi.fn(async () => ({
        id: "site_1",
        name: "Nordic Explorer",
        timezone: "Europe/Helsinki",
        publishHour: 8,
        frequency: "THREE_A_WEEK",
        autopilot: "REVIEW",
        schedule: { frequency: "THREE_A_WEEK", enabled: true },
        blueprint: null,
      })),
      ...((overrides.site as object) ?? {}),
    },
    agentTask: {
      create: calls.create,
      updateMany: calls.updateMany,
      findFirst: calls.findFirst,
      count: calls.count,
      ...((overrides.agentTask as object) ?? {}),
    },
    publishingSchedule: {
      upsert: calls.upsert,
      update: calls.update,
      ...((overrides.publishingSchedule as object) ?? {}),
    },
  };

  return { client, calls };
}

describe("autopilot task creation", () => {
  it("queues a GENERATE_ARTICLE task and enables the schedule for FULL mode", async () => {
    const { client, calls } = makeClient();
    const result = await enableAutopilot("site_1", "FULL", client as never);

    expect(result.enabled).toBe(true);
    expect(result.taskId).toBe("task_1");
    expect(result.nextRunAt).toBeInstanceOf(Date);

    expect(calls.create).toHaveBeenCalledTimes(1);
    const created = calls.create.mock.calls[0][0] as {
      data: { siteId: string; type: string; status: string; scheduledAt: Date; input: { title: string } };
    };
    expect(created.data.siteId).toBe("site_1");
    expect(created.data.type).toBe("GENERATE_ARTICLE");
    expect(created.data.status).toBe("QUEUED");
    expect(created.data.scheduledAt).toBeInstanceOf(Date);
    expect(created.data.input.title.length).toBeGreaterThan(0);

    expect(calls.upsert).toHaveBeenCalledTimes(1);
    const schedule = calls.upsert.mock.calls[0][0] as { create: { enabled: boolean } };
    expect(schedule.create.enabled).toBe(true);
  });

  it("does not duplicate the task when one is already queued", async () => {
    const create = vi.fn(async () => ({ id: "unused" }));
    const { client } = makeClient({
      agentTask: {
        create,
        updateMany: vi.fn(async () => ({ count: 0 })),
        findFirst: vi.fn(async () => ({ id: "task_existing", status: "QUEUED" })),
        count: vi.fn(async () => 0),
      },
    });

    const result = await enableAutopilot("site_1", "REVIEW", client as never);
    expect(result.taskId).toBe("task_existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("MANUAL disables the schedule and cancels queued generation work", async () => {
    const { client, calls } = makeClient();
    const result = await enableAutopilot("site_1", "MANUAL", client as never);

    expect(result.enabled).toBe(false);
    expect(result.taskId).toBeNull();
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "QUEUED", type: "GENERATE_ARTICLE" }),
        data: { status: "CANCELLED" },
      }),
    );
    expect(calls.upsert).toHaveBeenCalledTimes(1);
  });

  it("disableAutopilot switches to MANUAL, stops the schedule and cancels queued tasks", async () => {
    const { client, calls } = makeClient();
    const result = await disableAutopilot("site_1", client as never);

    expect(result.mode).toBe("MANUAL");
    expect(result.enabled).toBe(false);
    expect(calls.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { autopilot: "MANUAL" } }),
    );
    expect(calls.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
  });

  it("scheduleNextPublication returns null when the schedule is off", async () => {
    const { client } = makeClient({
      site: {
        findUnique: vi.fn(async () => ({
          id: "site_1",
          name: "Site",
          timezone: "UTC",
          publishHour: 9,
          frequency: "THREE_A_WEEK",
          autopilot: "MANUAL",
          schedule: { enabled: false },
          blueprint: null,
        })),
      },
    });
    expect(await scheduleNextPublication("site_1", client as never)).toBeNull();
  });
});

describe("schedule maths", () => {
  it("maps frequency to articles per week", () => {
    expect(articlesPerWeek("ONCE_A_WEEK")).toBe(1);
    expect(articlesPerWeek("THREE_A_WEEK")).toBe(3);
    expect(articlesPerWeek("DAILY")).toBe(7);
  });

  it("computes a future run time in the site timezone", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const next = computeNextRun("DAILY", { hour: 9, timezone: "UTC", from: now });
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getUTCHours()).toBe(9);
  });

  it("validates timezones", () => {
    expect(isValidTimeZone("Europe/Helsinki")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
