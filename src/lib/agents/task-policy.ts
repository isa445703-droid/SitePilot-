import { ZodError } from "zod";

/**
 * Retry policy for agent tasks.
 *
 * Kept in a dependency-free module on purpose: the orchestrator and the
 * scheduler import each other, so both must be able to reach this policy
 * without creating a cycle.
 */

/** Claims per task before it is failed for good. */
export const MAX_TASK_ATTEMPTS = 3;

/** A RUNNING task untouched for this long is considered stale (crashed run). */
export const STALE_TASK_MS = 15 * 60_000;

/** Exponential backoff between attempts: 30s, 60s, 120s … capped at 15 min. */
export function retryDelayMs(attempts: number): number {
  return Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * A retry only helps when the failure is transient (AI rate limit, network,
 * deadlock). Invalid input or a permission error fails identically every time.
 */
export function isRetryableTaskError(error: unknown): boolean {
  if (error instanceof ZodError) return false;
  const typed = error as { status?: unknown };
  if (typeof typed?.status === "number" && typed.status >= 400 && typed.status < 500) {
    return typed.status === 429;
  }
  return true;
}
