import "server-only";
import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { aiConfig } from "@/lib/env";
import { AiNotConfiguredError, AiResponseError, addUsage, type AiUsage } from "@/lib/ai/mistral";
import { ApiError } from "@/lib/api/http";
import { PermanentTaskError } from "./task-policy";
import type { AgentName } from "./permissions";

/**
 * Every AI operation goes through `withAgentRun`, which persists an AgentRun
 * row: agent, model, timing, success/failure, token usage and short (non
 * sensitive) input/output summaries.
 */

export type AgentRunContext = {
  siteId: string;
  taskId?: string | undefined;
  agent: AgentName;
  recordUsage: (usage: AiUsage) => void;
  setDemo: (isDemo: boolean) => void;
};

export type AgentRunSuccess<T> = { ok: true; value: T; runId: string; isDemo: boolean };
/**
 * Failures stay data. When the cause is a typed AI/provider error we keep its
 * status + code so API routes can answer 429/502/503 instead of a generic 500.
 * `permanent` marks failures that a retry can never fix (missing record, wrong
 * owner, archived content) so the task policy fails the task immediately.
 */
export type AgentRunFailure = {
  ok: false;
  error: string;
  runId: string;
  status?: number;
  code?: string;
  userMessage?: string;
  permanent?: boolean;
};
export type AgentRunResult<T> = AgentRunSuccess<T> | AgentRunFailure;

/** Rethrows an agent failure as the correct envelope error. */
export function throwAgentFailure(failure: {
  error?: string;
  status?: number;
  code?: string;
  userMessage?: string;
  permanent?: boolean;
}): never {
  const message = failure.userMessage ?? failure.error ?? "Request failed.";
  if (failure.permanent) {
    throw new PermanentTaskError(message, failure.status);
  }
  if (failure.status && failure.code) {
    throw new ApiError(failure.status, failure.code, message);
  }
  if (typeof failure.status === "number") {
    // Keep the status visible to the retry policy (4xx ⇒ permanent, 5xx ⇒ retry).
    throw Object.assign(new Error(message), { status: failure.status });
  }
  throw new Error(message);
}

function summarize(value: unknown, max = 240): string {
  const text =
    typeof value === "string"
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function withAgentRun<T>(
  options: {
    agent: AgentName;
    siteId: string;
    taskId?: string | undefined;
    model?: string;
    input: unknown;
    output?: (value: T) => unknown;
  },
  fn: (ctx: AgentRunContext) => Promise<T>,
): Promise<AgentRunResult<T>> {
  const startedAt = new Date();
  const t0 = Date.now();
  let usage: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let isDemo = false;

  const run = await db.agentRun.create({
    data: {
      siteId: options.siteId,
      taskId: options.taskId ?? null,
      agent: options.agent,
      model: options.model ?? (aiConfig.configured ? aiConfig.model : "demo"),
      status: "SUCCESS",
      startedAt,
      inputSummary: summarize(options.input),
    },
  });

  const ctx: AgentRunContext = {
    siteId: options.siteId,
    taskId: options.taskId,
    agent: options.agent,
    recordUsage: (u) => {
      usage = addUsage(usage, u);
    },
    setDemo: (value) => {
      isDemo = value;
    },
  };

  /**
   * A failed run is billed just like a successful one, so the usage ledger is
   * written on both paths — it used to be written only on success and quietly
   * under-reported the tokens an expensive, failing agent consumed.
   */
  const persistUsageEvent = async (tokens: AiUsage) => {
    if (tokens.totalTokens <= 0) return;
    await db.usageEvent
      .create({
        data: {
          siteId: options.siteId,
          agent: options.agent,
          model: isDemo ? "demo" : options.model ?? aiConfig.model,
          promptTokens: tokens.promptTokens,
          outputTokens: tokens.completionTokens,
        },
      })
      .catch((error) => logger.warn("usage_event_failed", { error: String(error) }));
  };

  try {
    const value = await fn(ctx);
    const finishedAt = new Date();
    const durationMs = Date.now() - t0;

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        finishedAt,
        durationMs,
        status: "SUCCESS",
        isDemo,
        model: isDemo ? "demo" : options.model ?? (aiConfig.configured ? aiConfig.model : "demo"),
        promptTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        outputSummary: summarize(options.output ? options.output(value) : value),
      },
    });

    await persistUsageEvent(usage);

    logger.info("agent_run_completed", {
      agent: options.agent,
      siteId: options.siteId,
      taskId: options.taskId,
      status: "SUCCESS",
      durationMs,
      isDemo,
      tokens: usage.totalTokens,
    });

    return { ok: true, value, runId: run.id, isDemo };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = Date.now() - t0;
    const message =
      error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);

    // Tokens spent by the attempts that failed travel on the error itself, so
    // a run that dies after three expensive retries still shows up in full.
    if (error instanceof AiResponseError && error.usage) usage = addUsage(usage, error.usage);

    await db.agentRun
      .update({
        where: { id: run.id },
        data: {
          finishedAt,
          durationMs,
          status: "FAILED",
          error: message,
          outputSummary: "",
          promptTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
        },
      })
      .catch(() => undefined);

    await persistUsageEvent(usage);

    logger.error("agent_run_failed", {
      agent: options.agent,
      siteId: options.siteId,
      taskId: options.taskId,
      status: "FAILED",
      durationMs,
      error: message,
    });

    if (error instanceof AiNotConfiguredError) {
      return { ok: false, error: message, runId: run.id, status: 503, code: error.code, userMessage: error.userMessage };
    }
    if (error instanceof AiResponseError) {
      return {
        ok: false,
        error: message,
        runId: run.id,
        status: error.status,
        code: error.code,
        userMessage: error.userMessage,
      };
    }

    // Any other typed failure keeps its status/code/permanence so the caller
    // (and the task retry policy) sees the real class of the error instead of
    // a bare message that would be retried three times.
    const typed = error as { status?: unknown; code?: unknown; permanent?: unknown };
    const status = typeof typed?.status === "number" ? typed.status : undefined;
    const code = typeof typed?.code === "string" ? typed.code : undefined;
    const permanent = typed?.permanent === true;

    return {
      ok: false,
      error: message,
      runId: run.id,
      ...(status !== undefined ? { status } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(permanent ? { permanent: true } : {}),
    };
  }
}
