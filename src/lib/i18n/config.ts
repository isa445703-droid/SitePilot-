export const LOCALES = ["en", "ru", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  ko: "한국어",
};

/** Text direction — architecture supports RTL even though current locales are LTR. */
export const LOCALE_DIRS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ru: "ltr",
  ko: "ltr",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP-47 tag used for Intl formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  ru: "ru-RU",
  ko: "ko-KR",
};

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], options).format(value);
}

export function formatDate(value: Date | string | number, locale: Locale, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], options ?? { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: Date | string | number, locale: Locale) {
  return formatDate(value, locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRelativeTime(value: Date | string | number, locale: Locale, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = date.getTime() - now;
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(LOCALE_TAGS[locale], { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return rtf.format(Math.round(diffMs / 1000), "second");
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
  return formatDate(date, locale);
}
