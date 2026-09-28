"use client";

import { useRouter } from "next/navigation";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useI18n, useT, LOCALE_COOKIE } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useTheme, type ThemePreference } from "@/components/theme/theme-provider";
import { Field, Select } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api/client";

const THEMES: Array<{ value: ThemePreference; Icon: typeof Sun }> = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
];

/** UI language + theme. Persisted in cookies; language is also stored on the account. */
export function AppearanceSettings() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const changeLocale = async (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    await setLocale(next);
    void api.patch("/api/settings", { locale: next }).catch(() => undefined);
    router.refresh();
  };

  return (
    <Card className="mb-4">
      <CardHeader title={t("settings.appearance")} />
      <CardBody className="space-y-5">
        <Field label={t("settings.uiLanguage")} help={t("settings.uiLanguageHelp")}>
          {({ id }) => (
            <Select id={id} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
              {LOCALES.map((item) => (
                <option key={item} value={item}>
                  {LOCALE_LABELS[item]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div>
          <span className="label" id="theme-label">
            {t("settings.theme")}
          </span>
          <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="theme-label">
            {THEMES.map(({ value, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => {
                  setTheme(value);
                  void api.patch("/api/settings", { theme: value }).catch(() => undefined);
                }}
                className={`btn ${theme === value ? "btn-primary" : "btn-secondary"} !justify-center`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{t(`settings.themes.${value}`)}</span>
                {theme === value ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
