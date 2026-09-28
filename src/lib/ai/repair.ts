import type { z } from "zod";

/**
 * Best-effort repairs for LLM output that is *shaped* wrongly but is still
 * recoverable without inventing content.
 *
 * Two separate concerns live here:
 *
 * 1. `parseJsonLoose` — turns an almost-JSON answer into a value. Closing
 *    unclosed brackets is opt-in and never closes a string that was cut
 *    mid-value: that would silently produce a *truncated article that
 *    validates*. Callers that genuinely know the text is complete can opt in
 *    with `closeString: true`.
 * 2. `normalizeForSchema` — applies only lossy-but-honest fixes to an already
 *    parsed value: shrink strings/arrays that exceed declared limits, and
 *    coerce shapes the model insists on returning (`content: { text }`,
 *    `"42"`). Missing required fields are never invented — those go back to the
 *    model as a retry.
 */

export type JsonFix = { path: string; action: string };

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "empty" | "invalid" };

/** Object keys most models use when they wrap a plain string in an object. */
const STRING_KEYS = [
  "text",
  "content",
  "body",
  "markdown",
  "value",
  "title",
  "name",
  "topic",
  "description",
  "excerpt",
  "summary",
  "detail",
  "label",
];

export function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

/** Removes a trailing comma before a closing bracket: `{ "a": 1, }` → `{ "a": 1 }`. */
function stripTrailingCommas(json: string): string {
  let out = json;
  let previous = "";
  while (out !== previous) {
    previous = out;
    out = out.replace(/,(\s*[}\]])/g, "$1");
  }
  return out;
}

/**
 * Closes brackets left open by a model that stopped mid-object.
 *
 * An unterminated *string* is treated differently from unclosed brackets: if the
 * text was cut while writing a value, closing the quote would hand back a
 * syntactically valid but silently shortened body. That is only allowed when the
 * caller passes `closeString: true`, which callers must not do for completions
 * that may have been truncated.
 */
export function closeUnbalanced(
  json: string,
  options: { closeString?: boolean } = {},
): string {
  let out = json;
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (const char of json) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") stack.pop();
  }

  if (inString) {
    if (!options.closeString) return json;
    out += '"';
  }
  out = out.replace(/,(\s*)$/, "");
  while (stack.length > 0) out += stack.pop();
  return out;
}

/**
 * Parses model output leniently: markdown fences, prose around the payload,
 * trailing commas and (optionally) unclosed structures. Strings cut mid-value
 * are only closed when `closeString` is explicitly requested — see
 * `closeUnbalanced`.
 */
export function parseJsonLoose(
  raw: string,
  options: { closeUnbalanced?: boolean; closeString?: boolean } = {},
): ParseResult {
  const text = stripFences(raw);
  if (!text.trim()) return { ok: false, reason: "empty" };

  const candidates: string[] = [];
  const push = (candidate: string) => {
    if (candidate.trim() && !candidates.includes(candidate)) candidates.push(candidate);
  };

  push(text);

  const start = Math.min(
    ...["{", "["].map((c) => (text.indexOf(c) === -1 ? Number.MAX_SAFE_INTEGER : text.indexOf(c))),
  );
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start !== Number.MAX_SAFE_INTEGER && end > start) push(text.slice(start, end + 1));

  for (const candidate of [...candidates]) push(stripTrailingCommas(candidate));

  if (options.closeUnbalanced) {
    for (const candidate of [...candidates]) {
      const closed = closeUnbalanced(candidate, { closeString: options.closeString });
      push(closed);
      push(stripTrailingCommas(closed));
    }
  }

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, reason: "invalid" };
}

/** Human-readable, bounded summary of Zod issues for the model's retry hint. */
export function formatIssues(issues: z.ZodIssue[], limit = 5, maxLength = 400): string {
  return issues
    .slice(0, limit)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ")
    .slice(0, maxLength);
}

export type NormalizeResult<S extends z.ZodTypeAny> =
  | { ok: true; data: z.infer<S>; fixes: JsonFix[] }
  | { ok: false; issues: z.ZodIssue[]; fixes: JsonFix[] };

function readAt(root: unknown, path: ReadonlyArray<string | number>): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string | number, unknown>)[key];
  }
  return cursor;
}

function writeAt(root: unknown, path: ReadonlyArray<string | number>, value: unknown): boolean {
  if (path.length === 0) return false;
  const parent = readAt(root, path.slice(0, -1));
  if (parent === null || typeof parent !== "object") return false;
  (parent as Record<string | number, unknown>)[path[path.length - 1]] = value;
  return true;
}

/** Cuts a string to `max` characters, preferring a word boundary. */
function truncateToMax(value: string, max: number): string | null {
  if (value.length <= max) return null;
  const window = value.slice(0, max);
  const boundary = window.lastIndexOf(" ");
  const cut = boundary > Math.floor(max * 0.5) ? window.slice(0, boundary) : window;
  const trimmed = cut.trim();
  return trimmed.length > 0 ? trimmed : window.trim() || null;
}

/** Pulls a plain string out of whatever the model returned instead. */
function extractString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractString(item);
      if (extracted !== null && extracted.trim()) return extracted;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of STRING_KEYS) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate;
      if (typeof candidate === "number") return String(candidate);
    }
    for (const candidate of Object.values(record)) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
      if (candidate && typeof candidate === "object") {
        const nested = extractString(candidate);
        if (nested !== null && nested.trim()) return nested;
      }
    }
  }
  return null;
}

const YES = /^(true|yes|y|1|да)$/i;
const NO = /^(false|no|n|0|нет)$/i;

/** Applies every fix that is provably safe. Returns the ones it actually made. */
function applyFixes(root: unknown, issues: z.ZodIssue[]): JsonFix[] {
  const applied: JsonFix[] = [];

  for (const issue of issues) {
    const pathLabel = issue.path.map(String).join(".") || "(root)";

    if (issue.code === "too_big") {
      // Zod types `maximum` as `number | bigint`; limits here are always small.
      const maximum = Number(issue.maximum);
      const current = readAt(root, issue.path);
      if (issue.type === "string" && typeof current === "string") {
        const next = truncateToMax(current, maximum);
        if (next !== null && writeAt(root, issue.path, next)) {
          applied.push({ path: pathLabel, action: `truncate_string<=${maximum}` });
        }
        continue;
      }
      if (issue.type === "array" && Array.isArray(current) && current.length > maximum) {
        if (writeAt(root, issue.path, current.slice(0, maximum))) {
          applied.push({ path: pathLabel, action: `trim_array<=${maximum}` });
        }
        continue;
      }
      continue;
    }

    if (issue.code !== "invalid_type") continue;

    const current = readAt(root, issue.path);
    // A missing required value cannot be repaired honestly — that is a retry.
    if (current === undefined || current === null) continue;

    if (issue.expected === "string") {
      const next = extractString(current);
      if (next !== null && writeAt(root, issue.path, next)) {
        applied.push({ path: pathLabel, action: "coerce_string" });
      }
      continue;
    }

    if (issue.expected === "number" && typeof current !== "object") {
      const parsed = Number(String(current).trim());
      if (Number.isFinite(parsed) && writeAt(root, issue.path, parsed)) {
        applied.push({ path: pathLabel, action: "coerce_number" });
      }
      continue;
    }

    if (issue.expected === "boolean" && typeof current !== "object") {
      const raw = String(current).trim();
      const parsed = YES.test(raw) ? true : NO.test(raw) ? false : null;
      if (parsed !== null && writeAt(root, issue.path, parsed)) {
        applied.push({ path: pathLabel, action: "coerce_boolean" });
      }
      continue;
    }
  }

  return applied;
}

const MAX_PASSES = 6;

/**
 * Validates `value` against `schema`, repairing what can be repaired between
 * passes. Stops as soon as the value validates or no further progress is made.
 */
export function normalizeForSchema<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): NormalizeResult<S> {
  // The value comes straight from JSON.parse, so it is structured-cloneable and
  // the caller's object stays untouched.
  const working: unknown = typeof value === "object" && value !== null ? structuredClone(value) : value;
  const fixes: JsonFix[] = [];

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const parsed = schema.safeParse(working);
    if (parsed.success) return { ok: true, data: parsed.data, fixes };

    const applied = applyFixes(working, parsed.error.issues);
    if (applied.length === 0) {
      return { ok: false, issues: parsed.error.issues, fixes };
    }
    fixes.push(...applied);
  }

  // Ran out of passes: report the last state as-is.
  const final = schema.safeParse(working);
  if (final.success) return { ok: true, data: final.data, fixes };
  return { ok: false, issues: final.error.issues, fixes };
}
