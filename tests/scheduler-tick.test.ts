import { beforeEach, describe, expect, it, vi } from "vitest";

// Hermetic setup: no Prisma, no database, no real orchestrator.
vi.mock("@/lib/db/prisma", () => ({
  db: {
    agentTask: { findMany: vi.fn(async () => []), findUnique: vi.fn(), updateMany: vi.fn() },
    site: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/auth/session", () => ({ purgeExpiredSessions: vi.fn(async () => 0) }));
vi.mock("@/lib/agents/orchestrator", () => ({ runTask: vi.fn() }));

import { logger } from "@/lib/logger";
import { runDueTasks, schedulerTick } from "@/lib/scheduler";
import { db } from "@/lib/db/prisma";
import { runTask } from "@/lib/agents/orchestrator";

const agentTask = db.agentTask as unknown as {
  findMany: ReturnType<typeof vi.fn>;
};
const site = db.site as unknown as { findMany: ReturnType<typeof vi.fn> };
const orchestratorRunTask = runTask as unknown as ReturnType<typeof vi.fn>;

/** Lets every pending microtask settle so the first tick reaches its gate. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.resetAllMocks();
  agentTask.findMany.mockResolvedValue([]);
  site.findMany.mockResolvedValue([]);
  orchestratorRunTask.mockResolvedValue(undefined);
});

describe("scheduler tick mutex", () => {
  it("refuses to start while another tick is in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    site.findMany.mockImplementationOnce(async () => {
      await gate;
      return [];
    });

    const first = schedulerTick();
    await settle();

    const second = await schedulerTick();
    expect(second).toEqual({ ran: 0, completed: 0, failed: 0, skipped: 0 });
    expect(logger.debug).toHaveBeenCalledWith("scheduler_tick_skipped", {
      reason: "already_running",
    });
    // The overlapping tick did no work of its own: recovery still ran once.
    expect(agentTask.findMany).toHaveBeenCalledTimes(1);

    release();
    const firstResult = await first;
    expect(firstResult).toEqual({ ran: 0, completed: 0, failed: 0, skipped: 0 });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("releases the lock after a failed tick", async () => {
    agentTask.findMany.mockRejectedValueOnce(new Error("db down"));
    await expect(schedulerTick()).resolves.toEqual({ ran: 0, completed: 0, failed: 1, skipped: 0 });
    expect(logger.error).toHaveBeenCalledWith(
      "scheduler_tick_failed",
      expect.objectContaining({ error: expect.stringContaining("db down") }),
    );

    const next = await schedulerTick();
    expect(next).toEqual({ ran: 0, completed: 0, failed: 0, skipped: 0 });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe("runDueTasks accounting", () => {
  it("counts a lost claim as skipped, not as a failure", async () => {
    agentTask.findMany.mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
    orchestratorRunTask.mockResolvedValueOnce({ taskId: "t1", ok: true });
    orchestratorRunTask.mockResolvedValueOnce({
      taskId: "t2",
      ok: false,
      skipped: true,
      error: "Task is RUNNING",
    });
    orchestratorRunTask.mockResolvedValueOnce({ taskId: "t3", ok: false, error: "boom" });

    const result = await runDueTasks();

    expect(result).toEqual({ ran: 3, completed: 1, failed: 1, skipped: 1 });
    expect(orchestratorRunTask).toHaveBeenCalledTimes(3);
  });

  it("stays idle when nothing is due", async () => {
    await expect(runDueTasks()).resolves.toEqual({ ran: 0, completed: 0, failed: 0, skipped: 0 });
    expect(orchestratorRunTask).not.toHaveBeenCalled();
  });

  it("picks up queued tasks that have no scheduledAt", async () => {
    agentTask.findMany.mockResolvedValueOnce([{ id: "stuck" }]);
    orchestratorRunTask.mockResolvedValueOnce({ taskId: "stuck", ok: true });

    const result = await runDueTasks();

    // Prisma cannot filter IS NULL, so the deadline is applied in JS: a task
    // without a schedule counts as due instead of blocking the queue forever.
    expect(agentTask.findMany.mock.calls.at(-1)?.[0]?.where).toEqual({ status: "QUEUED" });
    expect(result).toEqual({ ran: 1, completed: 1, failed: 0, skipped: 0 });
  });

  it("leaves tasks scheduled for the future alone", async () => {
    const future = new Date(Date.now() + 60_000);
    agentTask.findMany.mockResolvedValueOnce([{ id: "later", scheduledAt: future }]);

    await expect(runDueTasks()).resolves.toEqual({ ran: 0, completed: 0, failed: 0, skipped: 0 });
    expect(orchestratorRunTask).not.toHaveBeenCalled();
  });
});
