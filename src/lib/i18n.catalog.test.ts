import { describe, expect, it } from "vitest";
import { I18N_CATALOG, normalizeAppLocale, translate } from "@/lib/i18n";
import type { AppLocale } from "@/lib/types";

const SUPPORTED_LOCALES = Object.keys(I18N_CATALOG) as AppLocale[];

describe("i18n catalog governance", () => {
  it("keeps TH and EN translation keys in parity", () => {
    const englishKeys = Object.keys(I18N_CATALOG.en).sort();
    const thaiKeys = Object.keys(I18N_CATALOG.th).sort();
    expect(thaiKeys).toEqual(englishKeys);
  });

  it("returns non-empty text for all locales/keys and normalizes locale", () => {
    expect(normalizeAppLocale("th-TH")).toBe("th");
    expect(normalizeAppLocale("en-US")).toBe("en");
    expect(normalizeAppLocale("")).toBe("en");

    const keys = Object.keys(I18N_CATALOG.en);
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keys) {
        const message = translate(locale, key as keyof typeof I18N_CATALOG.en);
        expect(message.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
