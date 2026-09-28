import { describe, expect, it, vi } from "vitest";

// Same hermetic setup as the autopilot suite: no Prisma, no database.
vi.mock("@/lib/db/prisma", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { recoverStuckTasks } from "@/lib/scheduler";
import { MAX_TASK_ATTEMPTS } from "@/lib/agents/task-policy";

function stubClient(stuck: Array<Record<string, unknown>>) {
  const update = vi.fn(async (_args: Record<string, unknown>) => ({ args: {} }));
  return {
    client: {
      agentTask: {
        findMany: vi.fn(async () => stuck),
        update,
      },
    },
    update,
  };
}

describe("stale task recovery", () => {
  it("requeues a task that was left RUNNING by a crashed process", async () => {
    const { client, update } = stubClient([
      { id: "task_1", attempts: 1, status: "RUNNING", startedAt: new Date(Date.now() - 60_000) },
    ]);

    const result = await recoverStuckTasks(1, client as never);

    expect(result).toEqual({ requeued: 1, failed: 0 });
    expect(update).toHaveBeenCalledTimes(1);
    const call = update.mock.calls[0][0] as { where: { id: string }; data: { status: string } };
    expect(call.where.id).toBe("task_1");
    expect(call.data.status).toBe("QUEUED");
  });

  it("fails a stalled task that already used every attempt", async () => {
    const { client, update } = stubClient([
      { id: "task_poison", attempts: MAX_TASK_ATTEMPTS, status: "RUNNING", startedAt: new Date() },
    ]);

    const result = await recoverStuckTasks(1, client as never);

    expect(result).toEqual({ requeued: 0, failed: 1 });
    const call = update.mock.calls[0][0] as { data: { status: string; completedAt: Date } };
    expect(call.data.status).toBe("FAILED");
    expect(call.data.completedAt).toBeInstanceOf(Date);
  });

  it("touches nothing when no task is stale", async () => {
    const { client, update } = stubClient([]);

    const result = await recoverStuckTasks(1, client as never);

    expect(result).toEqual({ requeued: 0, failed: 0 });
    expect(update).not.toHaveBeenCalled();
    expect(client.agentTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("treats a RUNNING row without startedAt as stuck", async () => {
    const { client, update } = stubClient([
      { id: "task_null", attempts: 0, status: "RUNNING", startedAt: null },
    ]);

    const result = await recoverStuckTasks(1, client as never);

    expect(result.requeued).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
