/** Client-side API helpers. Every route returns the { ok, data|error } envelope. */

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; issues?: Array<{ path: string; message: string }> } };

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init: { method: string; body?: unknown } = { method: "GET" },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method,
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("NETWORK", "network", 0);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const envelope = payload as ApiEnvelope<T> | null;
  if (envelope && typeof envelope === "object" && "ok" in envelope) {
    if (envelope.ok) return envelope.data;
    throw new ApiClientError(
      envelope.error.code,
      envelope.error.message,
      response.status,
      envelope.error.issues,
    );
  }

  if (response.ok) return payload as T;
  throw new ApiClientError("HTTP", "request_failed", response.status);
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ?? {} }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body: body ?? {} }),
};

/**
 * Maps an API error code to a translation key when possible, so the UI never
 * shows a raw stack or an untranslated technical message.
 */
export function errorKeyFor(error: unknown): string | null {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case "NETWORK":
        return "errors.network";
      case "UNAUTHORIZED":
        return "errors.unauthorized";
      case "FORBIDDEN":
        return "errors.forbidden";
      case "RATE_LIMITED":
        return "errors.rateLimited";
      case "AI_NOT_CONFIGURED":
        return "errors.aiNotConfigured";
      case "VALIDATION":
        return "errors.validation";
      case "NOT_FOUND":
        return "errors.notFound";
      case "INVALID_CREDENTIALS":
        return "auth.invalidCredentials";
      case "EMAIL_TAKEN":
        return "auth.emailTaken";
      default:
        return null;
    }
  }
  return null;
}

/** Best-effort localized message for any thrown error. */
export function errorMessage(
  error: unknown,
  t: (key: string) => string,
  fallbackKey = "errors.generic",
): string {
  const key = errorKeyFor(error);
  return t(key ?? fallbackKey);
}

/** Field-level validation issues (path → message key) for form rendering. */
export function issuesFor(error: unknown): Record<string, string> {
  if (error instanceof ApiClientError && error.issues) {
    const out: Record<string, string> = {};
    for (const issue of error.issues) out[issue.path] = issue.message;
    return out;
  }
  return {};
}
