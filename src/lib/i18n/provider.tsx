"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  LOCALE_DIRS,
  LOCALE_TAGS,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  resolveLocale,
  type Locale,
} from "./config";
import { getMessages, translate, type Messages } from "./dictionaries";

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  tag: string;
  messages: Messages;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => Promise<void>;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date | string | number) => string;
  formatRelativeTime: (value: Date | string | number) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const LOCALE_COOKIE = "sitepilot_locale";

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(() => resolveLocale(initialLocale));
  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(messages, key, params),
    [messages],
  );

  const setLocale = useCallback(
    async (next: Locale) => {
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = LOCALE_DIRS[next];
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: LOCALE_DIRS[locale],
      tag: LOCALE_TAGS[locale],
      messages,
      t,
      setLocale,
      formatNumber: (v, options) => formatNumber(v, locale, options),
      formatDate: (v, options) => formatDate(v, locale, options),
      formatDateTime: (v) => formatDateTime(v, locale),
      formatRelativeTime: (v) => formatRelativeTime(v, locale),
    }),
    [locale, messages, t, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Shorthand for components that only need `t`. */
export function useT() {
  return useI18n().t;
}
