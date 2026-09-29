import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AccessError } from "@/lib/auth/guards";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { AiNotConfiguredError, AiResponseError } from "@/lib/ai/mistral";
import { logger } from "@/lib/logger";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Consistent JSON envelope for every API route. */

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string; issues?: Array<{ path: string; message: string }> };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Please sign in to continue.") {
    super(401, "UNAUTHORIZED", message);
  }
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function enforceRateLimit(req: Request, key: string, limit = 30, windowMs = 60_000) {
  const result = rateLimit(`${key}:${clientIp(req.headers)}`, limit, windowMs);
  if (!result.ok) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `Too many requests. Try again in ${result.retryAfterSeconds}s.`,
    );
  }
  return result;
}

/** Wraps a handler with the standard envelope + error handling. */
export async function handleApi<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, data } satisfies ApiSuccess<T>, { status: 200 });
  } catch (error) {
    const failure = toApiFailure(error);
    if (failure.status >= 500) {
      logger.error("api_error", {
        status: failure.status,
        code: failure.error.code,
        message: failure.error.message,
        error: error instanceof Error ? error.name : typeof error,
      });
    }
    return NextResponse.json(failure, { status: failure.status });
  }
}

function toApiFailure(error: unknown): { status: number } & ApiFailure {
  if (error instanceof ZodError) {
    return {
      status: 400,
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Please fix the highlighted fields.",
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    };
  }
  if (error instanceof ApiError || error instanceof UnauthorizedError) {
    return { status: error.status, ok: false, error: { code: error.code, message: error.message } };
  }
  if (error instanceof AccessError) {
    return { status: 403, ok: false, error: { code: "FORBIDDEN", message: error.message } };
  }
  // Permanent failures (PermanentTaskError): report the status they carry
  // (404/403/409) instead of falling through to a generic 500.
  const marked = error as { permanent?: unknown; status?: unknown; message?: unknown };
  if (marked?.permanent === true) {
    const status = typeof marked.status === "number" ? marked.status : 400;
    const code =
      status === 404
        ? "NOT_FOUND"
        : status === 403
          ? "FORBIDDEN"
          : status === 409
            ? "CONFLICT"
            : "INVALID_REQUEST";
    return {
      status,
      ok: false,
      error: { code, message: typeof marked.message === "string" ? marked.message : "Request failed." },
    };
  }
  // Typed AI errors carry a user-safe message; they must be handled before the
  // generic `{ status, code, message }` shape below, or the raw provider detail
  // (which can include upstream response bodies) would be sent to the client.
  if (error instanceof AiNotConfiguredError) {
    return {
      status: 503,
      ok: false,
      error: { code: "AI_NOT_CONFIGURED", message: error.userMessage },
    };
  }
  if (error instanceof AiResponseError) {
    return { status: error.status, ok: false, error: { code: error.code, message: error.userMessage } };
  }
  const pseudo = error as { status?: unknown; code?: unknown; message?: unknown };
  if (
    typeof pseudo?.status === "number" &&
    typeof pseudo?.code === "string" &&
    typeof pseudo?.message === "string"
  ) {
    return { status: pseudo.status, ok: false, error: { code: pseudo.code, message: pseudo.message } };
  }
  if (error instanceof Error && /not found/i.test(error.message)) {
    return { status: 404, ok: false, error: { code: "NOT_FOUND", message: error.message } };
  }
  if (error instanceof Error && /forbidden/i.test(error.message)) {
    return { status: 403, ok: false, error: { code: "FORBIDDEN", message: "You don't have access to this resource." } };
  }

  logger.error("api_unhandled_error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? (error.stack ?? "").split("\n").slice(0, 3).join(" | ") : "",
  });

  return {
    status: 500,
    ok: false,
    error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
  };
}
