import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/db/prisma", () => ({ db: {} }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ApiError, UnauthorizedError, handleApi } from "@/lib/api/http";
import { AccessError } from "@/lib/auth/guards";
import { PermanentTaskError } from "@/lib/agents/task-policy";
import { AiNotConfiguredError, AiResponseError } from "@/lib/ai/mistral";
import { logger } from "@/lib/logger";

type Failure = {
  ok: false;
  error: { code: string; message: string; issues?: Array<{ path: string; message: string }> };
};

async function run(fn: () => Promise<unknown>): Promise<{ status: number; body: Failure }> {
  const res = await handleApi(fn);
  return { status: res.status, body: (await res.json()) as Failure };
}

/** The `{ status, code, message }` shape typed route errors are built with. */
function typedError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code });
}

describe("API envelope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wraps a successful payload in { ok: true, data }", async () => {
    const res = await handleApi(async () => ({ id: "site_1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { id: "site_1" } });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("maps a ZodError to 400 VALIDATION with per-field issues", async () => {
    const { status, body } = await run(() =>
      Promise.reject(z.object({ email: z.string().email() }).parse({ email: "nope" })),
    );

    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.issues).toEqual([
      { path: "email", message: expect.any(String) as unknown as string },
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("keeps the status and code of an ApiError", async () => {
    const { status, body } = await run(() => Promise.reject(new ApiError(409, "CONFLICT", "Already exists.")));

    expect(status).toBe(409);
    expect(body.error).toEqual({ code: "CONFLICT", message: "Already exists." });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("maps an unauthenticated caller to 401 UNAUTHORIZED", async () => {
    const { status, body } = await run(() => Promise.reject(new UnauthorizedError()));

    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("maps AccessError to 403 FORBIDDEN", async () => {
    const { status, body } = await run(() => Promise.reject(new AccessError("Not your site.")));

    expect(status).toBe(403);
    expect(body.error).toEqual({ code: "FORBIDDEN", message: "Not your site." });
  });

  it("keeps the status permanent failures carry instead of collapsing to 500", async () => {
    const statuses = [404, 403, 409];
    for (const status of statuses) {
      const { status: got } = await run(() =>
        Promise.reject(new PermanentTaskError("Site was deleted.", status)),
      );
      expect(got).toBe(status);
    }

    const { body } = await run(() => Promise.reject(new PermanentTaskError("Site was deleted.", 404)));
    expect(body.error.code).toBe("NOT_FOUND");

    // Without a status a permanent failure still answers a client error.
    const fallback = await run(() => Promise.reject(new PermanentTaskError("Bad input.")));
    expect(fallback.status).toBe(400);
    expect(fallback.body.error.code).toBe("INVALID_REQUEST");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("hides the raw provider detail behind AiNotConfiguredError's user message", async () => {
    const { status, body } = await run(() => Promise.reject(new AiNotConfiguredError()));

    expect(status).toBe(503);
    expect(body.error.code).toBe("AI_NOT_CONFIGURED");
    expect(body.error.message).toBe("AI provider is not configured.");
    expect(body.error.message).not.toContain("MISTRAL_API_KEY");
  });

  it("maps a provider rate limit to 429 with a retryable message", async () => {
    const { status, body } = await run(() =>
      Promise.reject(
        new AiResponseError("Mistral API responded 429: slow down", "Please retry shortly.", 429),
      ),
    );

    expect(status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toBe("Please retry shortly.");
    expect(body.error.message).not.toContain("Mistral API responded 429");

    const other = await run(() => Promise.reject(new AiResponseError("upstream 500 body", "Try again.", 500)));
    expect(other.status).toBe(502);
    expect(other.body.error.code).toBe("AI_RESPONSE_ERROR");
    expect(other.body.error.message).toBe("Try again.");
  });

  it("passes through the { status, code, message } shape typed routes throw", async () => {
    const { status, body } = await run(() => Promise.reject(typedError(409, "EMAIL_TAKEN", "Already registered.")));

    expect(status).toBe(409);
    expect(body.error).toEqual({ code: "EMAIL_TAKEN", message: "Already registered." });
  });

  it("recognises plain 'not found' / 'forbidden' messages", async () => {
    const missing = await run(() => Promise.reject(new Error("Site not found")));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");

    const denied = await run(() => Promise.reject(new Error("Forbidden for this org")));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
  });

  it("falls back to a generic 500 and logs the failure", async () => {
    const { status, body } = await run(() => Promise.reject(new Error("connection string leaked?")));

    expect(status).toBe(500);
    expect(body.error).toEqual({
      code: "INTERNAL",
      message: "Something went wrong. Please try again.",
    });
    expect(body.error.message).not.toContain("connection string");
    expect(logger.error).toHaveBeenCalledWith("api_error", expect.objectContaining({ status: 500 }));
  });
});
