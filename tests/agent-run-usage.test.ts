import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Hermetic: no database, no provider. Only the run bookkeeping is under test.
vi.mock("@/lib/db/prisma", () => ({
  db: {
    agentRun: { create: vi.fn(), update: vi.fn() },
    usageEvent: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { withAgentRun } from "@/lib/agents/run";
import { AiResponseError } from "@/lib/ai/mistral";
import { db } from "@/lib/db/prisma";

const agentRun = db.agentRun as unknown as { create: Mock; update: Mock };
const usageEvent = db.usageEvent as unknown as { create: Mock };

const usage = (prompt: number, completion: number) => ({
  promptTokens: prompt,
  completionTokens: completion,
  totalTokens: prompt + completion,
});

beforeEach(() => {
  vi.clearAllMocks();
  agentRun.create.mockResolvedValue({ id: "run_1" });
  agentRun.update.mockResolvedValue({});
  usageEvent.create.mockResolvedValue({});
});

describe("withAgentRun usage ledger", () => {
  it("stores the tokens of a successful run on the run and in the ledger", async () => {
    const result = await withAgentRun({ agent: "writer", siteId: "site_1", input: {} }, async (ctx) => {
      ctx.recordUsage(usage(5, 7));
      return { title: "Hello" };
    });

    expect(result.ok).toBe(true);
    expect(agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS", promptTokens: 5, outputTokens: 7 }),
      }),
    );
    expect(usageEvent.create).toHaveBeenCalledTimes(1);
    expect(usageEvent.create.mock.calls[0][0].data).toMatchObject({
      siteId: "site_1",
      agent: "writer",
      promptTokens: 5,
      outputTokens: 7,
    });
  });

  it("adds the tokens carried by a failed AI error instead of dropping them", async () => {
    const result = await withAgentRun({ agent: "writer", siteId: "site_1", input: {} }, async (ctx) => {
      // One call succeeded…
      ctx.recordUsage(usage(10, 20));
      // …then the next one burned three attempts and threw. Those tokens must
      // reach the ledger too: a failing run is still a billed run.
      throw new AiResponseError("truncated after 3 attempts", "Please retry shortly.", 429, usage(30, 60));
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(429);
    expect(result.code).toBe("RATE_LIMITED");
    expect(result.userMessage).toBe("Please retry shortly.");

    expect(agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          promptTokens: 40,
          outputTokens: 80,
        }),
      }),
    );
    expect(usageEvent.create).toHaveBeenCalledTimes(1);
    expect(usageEvent.create.mock.calls[0][0].data).toMatchObject({
      promptTokens: 40,
      outputTokens: 80,
    });
  });

  it("records nothing when no token was ever spent", async () => {
    const result = await withAgentRun({ agent: "writer", siteId: "site_1", input: {} }, async () => {
      throw new Error("exploded before any call");
    });

    expect(result.ok).toBe(false);
    expect(usageEvent.create).not.toHaveBeenCalled();
    expect(agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", promptTokens: 0, outputTokens: 0 }),
      }),
    );
  });

  it("still returns the typed failure when the ledger write itself fails", async () => {
    usageEvent.create.mockRejectedValue(new Error("db down"));

    const result = await withAgentRun(
      { agent: "writer", siteId: "site_1", input: {} },
      async (ctx) => {
        ctx.recordUsage(usage(1, 2));
        throw new AiResponseError("bad", "Try again.", 502, usage(3, 4));
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(502);
  });
});
