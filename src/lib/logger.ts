/* Structured server-side logging. Never logs secrets or API keys. */

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  requestId?: string;
  userId?: string;
  siteId?: string;
  taskId?: string;
  agent?: string;
  status?: string | number;
  durationMs?: number;
  route?: string;
  [key: string]: unknown;
};

const SENSITIVE = /(password|secret|api[-_]?key|authorization|token|cookie|hash)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    if (SENSITIVE.test(value) && value.length > 24) return "[redacted]";
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  return value;
}

function emit(level: LogLevel, msg: string, ctx: LogContext = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(redact(ctx) as Record<string, unknown>),
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};

/** Human-readable message for the UI — never a stack trace. */
export function toUserMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error && typeof error === "object" && "userMessage" in error) {
    const m = (error as { userMessage?: unknown }).userMessage;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
