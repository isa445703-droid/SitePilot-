import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_TASK_ATTEMPTS,
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

  it("uses a stale window long enough to outlive a slow AI call", () => {
    expect(STALE_TASK_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });
});
