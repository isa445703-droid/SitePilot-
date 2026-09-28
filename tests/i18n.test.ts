import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DIRS,
  LOCALE_LABELS,
  LOCALE_TAGS,
  formatDate,
  formatNumber,
  isLocale,
  resolveLocale,
} from "@/lib/i18n/config";
import {
  dictionaries,
  flattenKeys,
  getMessages,
  translate,
  type Messages,
} from "@/lib/i18n/dictionaries";

describe("languages", () => {
  it("ships English, Russian and Korean with labels and tags", () => {
    expect([...LOCALES]).toEqual(["en", "ru", "ko"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALE_LABELS.ru).toBe("Русский");
    expect(LOCALE_LABELS.ko).toBe("한국어");
    expect(LOCALE_TAGS.ko).toBe("ko-KR");
    expect(Object.keys(LOCALE_DIRS)).toHaveLength(LOCALES.length);
  });

  it("keeps every dictionary in sync (no missing or extra keys)", () => {
    const reference = new Set(flattenKeys(dictionaries.en));
    expect(reference.size).toBeGreaterThan(200);

    for (const locale of LOCALES) {
      const keys = new Set(flattenKeys(dictionaries[locale]));
      const missing = [...reference].filter((key) => !keys.has(key));
      const extra = [...keys].filter((key) => !reference.has(key));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
      expect({ locale, extra }).toEqual({ locale, extra: [] });
    }
  });

  it("actually translates shared UI strings for each locale", () => {
    const sharedKeys = ["common.save", "common.cancel", "nav.dashboard", "common.signIn", "sites.create"];

    for (const key of sharedKeys) {
      const en = translate(dictionaries.en, key);
      expect(en).not.toBe(key);
      for (const locale of ["ru", "ko"] as const) {
        const value = translate(dictionaries[locale], key);
        expect(value).not.toBe(key);
        expect(value).not.toBe(en);
      }
    }
  });

  it("interpolates parameters and falls back to English then to the key", () => {
    expect(translate(dictionaries.en, "common.step", { current: 2, total: 4 })).toBe(
      "Step 2 of 4",
    );

    const partial = { common: { save: "Speichern" } } as unknown as Messages;
    expect(translate(partial, "common.save")).toBe("Speichern");
    expect(translate(partial, "common.cancel")).toBe(dictionaries.en.common.cancel);
    expect(translate(partial, "does.not.exist")).toBe("does.not.exist");
  });

  it("switches language by resolving the requested locale", () => {
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale("ko")).toBe("ko");
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
    expect(isLocale("ko")).toBe(true);
    expect(isLocale("xx")).toBe(false);
    expect(getMessages("ko")).toBe(dictionaries.ko);
  });

  it("formats numbers and dates per locale", () => {
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
    const date = new Date(Date.UTC(2026, 0, 15));
    const en = formatDate(date, "en", { dateStyle: "medium", timeZone: "UTC" });
    const ru = formatDate(date, "ru", { dateStyle: "medium", timeZone: "UTC" });
    expect(en).toContain("2026");
    expect(ru).toContain("2026");
    expect(ru).not.toBe(en);
  });
});
