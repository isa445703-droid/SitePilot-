import { describe, expect, it, vi } from "vitest";

// Keep the module importable outside a request scope.
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { hashSessionToken } from "@/lib/auth/session";

describe("session token hashing", () => {
  it("never stores the raw token", () => {
    const raw = "Gq0t6l1S8tYyq0r4iP2M7x1n9d0v3c5b";
    expect(hashSessionToken(raw)).not.toContain(raw);
  });

  it("is a stable sha256 hex digest", () => {
    const raw = "same-token";
    const first = hashSessionToken(raw);
    expect(first).toBe(hashSessionToken(raw));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives different tokens different hashes", () => {
    expect(hashSessionToken("token-a")).not.toBe(hashSessionToken("token-b"));
  });

  it("cannot be reversed by looking for a short input", () => {
    // A 32-byte random token hashes to a fixed 64-char digest; the digest
    // must not embed the token itself.
    const raw = "abcdefghijklmnop";
    expect(hashSessionToken(raw).includes(raw)).toBe(false);
  });
});
