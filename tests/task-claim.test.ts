import { beforeEach, describe, expect, it, vi } from "vitest";

// Hermetic: the orchestrator is exercised without a database or AI calls.
vi.mock("@/lib/db/prisma", () => ({
  db: { agentTask: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "@/lib/logger";
import { runTask } from "@/lib/agents/orchestrator";
import { db } from "@/lib/db/prisma";

const agentTask = db.agentTask as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("runTask claim outcomes", () => {
  it("treats a lost claim as skipped, never as a task failure", async () => {
    agentTask.findUnique
      .mockResolvedValueOnce({ id: "t1", status: "QUEUED", attempts: 0, siteId: "s1" })
      .mockResolvedValueOnce({ id: "t1", status: "RUNNING", attempts: 1, siteId: "s1" });
    agentTask.updateMany.mockResolvedValueOnce({ count: 0 });

    const outcome = await runTask("t1");

    expect(outcome).toMatchObject({ ok: false, skipped: true, error: "Task is RUNNING" });
    expect(logger.info).toHaveBeenCalledWith("task_claim_miss", {
      taskId: "t1",
      status: "RUNNING",
    });
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns loudly when the task vanished entirely", async () => {
    agentTask.findUnique.mockResolvedValueOnce(null);

    const outcome = await runTask("gone");

    expect(outcome).toMatchObject({ ok: false, error: "Task not found" });
    expect(logger.warn).toHaveBeenCalledWith("task_missing", { taskId: "gone" });
  });

  it("still claims a genuinely queued task before doing any work", async () => {
    agentTask.findUnique.mockResolvedValue({ id: "t2", status: "QUEUED", attempts: 1, siteId: "s1" });
    agentTask.updateMany.mockResolvedValueOnce({ count: 1 });
    (db.agentTask as unknown as Record<string, unknown>).update = vi.fn(async () => ({}));

    const outcome = await runTask("t2");

    expect(agentTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t2", status: "QUEUED" },
        data: expect.objectContaining({ status: "RUNNING" }),
      }),
    );
    // The dispatch itself needs a real site and the AI layer, which this
    // hermetic suite has no opinion about: what matters is that the task was
    // claimed first and the outcome was not mislabelled as a skip.
    expect(outcome.ok).toBe(false);
    expect(outcome.skipped).toBeUndefined();
    expect(logger.info).not.toHaveBeenCalledWith("task_claim_miss", expect.anything());
  });
});
