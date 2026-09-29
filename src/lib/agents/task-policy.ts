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
 * A failure that would repeat identically on every attempt: a missing record,
 * a record that belongs to another site, content that can no longer be
 * published. The task is failed immediately instead of spending the remaining
 * attempts (and their backoff windows) on an error that can never succeed.
 *
 * `status` is optional: pass the HTTP-ish code it maps to (404/403/409) when
 * one exists, so API callers see the same number the task recorded.
 */
export class PermanentTaskError extends Error {
  readonly permanent = true;

  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PermanentTaskError";
  }
}

/**
 * A retry only helps when the failure is transient (AI rate limit, network,
 * deadlock). Invalid input or a permission error fails identically every time.
 */
export function isRetryableTaskError(error: unknown): boolean {
  if (error instanceof ZodError) return false;
  const typed = error as { permanent?: unknown; status?: unknown };
  // Explicit marker (PermanentTaskError or anything flagged `permanent`).
  if (typed?.permanent === true) return false;
  if (typeof typed?.status === "number" && typed.status >= 400 && typed.status < 500) {
    return typed.status === 429;
  }
  return true;
}
