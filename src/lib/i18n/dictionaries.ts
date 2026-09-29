import en from "@locales/en.json";
import ru from "@locales/ru.json";
import ko from "@locales/ko.json";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * The `en` dictionary is the source of truth for the `Messages` type.
 * Because every dictionary is typed as `Messages`, TypeScript fails the build
 * when a translation is missing a key; tests/i18n.test.ts additionally checks
 * for extra/unknown keys in ru and ko.
 */
export type Messages = typeof en;

export const dictionaries: Record<Locale, Messages> = {
  en,
  ru: ru as unknown as Messages,
  ko: ko as unknown as Messages,
};

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

type Params = Record<string, string | number>;

function lookup(obj: unknown, path: string): string | undefined {
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/**
 * Translate a dot-path key. Falls back to English, then to the key itself, so a
 * missing translation never breaks the UI.
 */
export function translate(messages: Messages, key: string, params?: Params): string {
  const value = lookup(messages, key);
  if (value !== undefined) return interpolate(value, params);
  const fallback = lookup(dictionaries[DEFAULT_LOCALE], key);
  if (fallback !== undefined) return interpolate(fallback, params);
  return key;
}

/** Collect every translation key (dot paths) of a dictionary — used by tests. */
export function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}
