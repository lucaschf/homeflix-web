import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import en from "../i18n/locales/en.json";
import ptBR from "../i18n/locales/pt-BR.json";
import { restrictedContentKeys } from "./restrictedContent";

const forbidden = (code: string) => new ApiError(403, "Forbidden", { code, details: [] });

/** Resolve a dotted key against a locale file. */
function lookup(locale: object, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);
}

describe("restrictedContentKeys", () => {
  it("maps a title above the profile's limit to its own copy", () => {
    expect(restrictedContentKeys(forbidden("CONTENT_RESTRICTED_BY_MATURITY"))).toEqual({
      titleKey: "detail.restricted.title",
      bodyKey: "detail.restricted.maturityBody",
    });
  });

  it("maps an unrated title to its own copy", () => {
    expect(restrictedContentKeys(forbidden("CONTENT_RESTRICTED_UNRATED"))).toEqual({
      titleKey: "detail.restricted.title",
      bodyKey: "detail.restricted.unratedBody",
    });
  });

  it("leaves every other failure on the generic copy", () => {
    expect(restrictedContentKeys(forbidden("PARENTAL_PIN_REQUIRED"))).toBeUndefined();
    expect(restrictedContentKeys(new ApiError(404, "Not Found", null))).toBeUndefined();
    expect(restrictedContentKeys(new Error("CONTENT_RESTRICTED_UNRATED"))).toBeUndefined();
    expect(restrictedContentKeys(null)).toBeUndefined();
  });

  it.each([
    ["en", en],
    ["pt-BR", ptBR],
  ])("has every key translated in %s", (_name, locale) => {
    for (const code of ["CONTENT_RESTRICTED_BY_MATURITY", "CONTENT_RESTRICTED_UNRATED"]) {
      const keys = restrictedContentKeys(forbidden(code))!;
      expect(typeof lookup(locale, keys.titleKey)).toBe("string");
      expect(typeof lookup(locale, keys.bodyKey)).toBe("string");
    }
  });
});
