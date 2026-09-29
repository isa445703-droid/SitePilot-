import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_TASK_ATTEMPTS,
  PermanentTaskError,
  STALE_TASK_MS,
  isRetryableTaskError,
  retryDelayMs,
} from "@/lib/agents/task-policy";

describe("task retry policy", () => {
  it("caps the number of attempts", () => {
    expect(MAX_TASK_ATTEMPTS).toBe(3);
  });

  it("backs off exponentially and never exceeds 15 minutes", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(10)).toBe(15 * 60_000);
    expect(retryDelayMs(0)).toBe(30_000);
  });

  it("treats transient failures as retryable", () => {
    expect(isRetryableTaskError(new Error("socket hang up"))).toBe(true);
    expect(isRetryableTaskError(Object.assign(new Error("rate limited"), { status: 429 }))).toBe(
      true,
    );
    expect(isRetryableTaskError(Object.assign(new Error("upstream"), { status: 502 }))).toBe(true);
  });

  it("does not retry failures that would repeat identically", () => {
    const invalid = z.string().safeParse(42).error;
    expect(invalid).toBeDefined();
    expect(isRetryableTaskError(invalid)).toBe(false);
    expect(isRetryableTaskError(Object.assign(new Error("bad input"), { status: 400 }))).toBe(false);
    expect(isRetryableTaskError(Object.assign(new Error("no access"), { status: 403 }))).toBe(false);
  });

  it("fails permanent task errors immediately, without spending attempts", () => {
    expect(isRetryableTaskError(new PermanentTaskError("Site not found", 404))).toBe(false);
    expect(isRetryableTaskError(new PermanentTaskError("Article does not belong to this site", 403))).toBe(
      false,
    );
    expect(isRetryableTaskError(new PermanentTaskError("Archived articles cannot be published", 409))).toBe(
      false,
    );
    // No HTTP status (programming error) — still permanent.
    expect(isRetryableTaskError(new PermanentTaskError("Unknown task type: X"))).toBe(false);
    // An explicit permanent marker wins over a transport-looking status.
    expect(isRetryableTaskError(Object.assign(new Error("nope"), { permanent: true }))).toBe(false);
    expect(isRetryableTaskError(new PermanentTaskError("rate limited", 429))).toBe(false);
  });

  it("still retries transient upstream statuses", () => {
    expect(isRetryableTaskError(Object.assign(new Error("ai down"), { status: 502 }))).toBe(true);
    expect(isRetryableTaskError(Object.assign(new Error("not configured"), { status: 503 }))).toBe(true);
    expect(isRetryableTaskError(new Error("ECONNRESET"))).toBe(true);
  });

  it("uses a stale window long enough to outlive a slow AI call", () => {
    expect(STALE_TASK_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });
});
