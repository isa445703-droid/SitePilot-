import "server-only";
import { cookies } from "next/headers";
import { LOCALE_DIRS, resolveLocale, type Locale } from "./config";
import { getMessages, translate, type Messages } from "./dictionaries";

/**
 * Server-side i18n: pages/components rendered on the server use this instead of
 * the client context. Same dictionaries, same fallback behaviour.
 */
export async function getServerI18n(): Promise<{
  locale: Locale;
  dir: "ltr" | "rtl";
  messages: Messages;
  t: (key: string, params?: Record<string, string | number>) => string;
}> {
  const store = await cookies();
  const locale = resolveLocale(store.get("sitepilot_locale")?.value);
  const messages = getMessages(locale);
  return {
    locale,
    dir: LOCALE_DIRS[locale],
    messages,
    t: (key, params) => translate(messages, key, params),
  };
}

/** Non-async variant for components that already know the locale. */
export function getServerI18nFor(localeValue: string | undefined) {
  const locale = resolveLocale(localeValue);
  const messages = getMessages(locale);
  return {
    locale,
    dir: LOCALE_DIRS[locale],
    messages,
    t: (key: string, params?: Record<string, string | number>) =>
      translate(messages, key, params),
  };
}
