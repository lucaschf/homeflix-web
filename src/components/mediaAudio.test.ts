import { describe, expect, it } from "vitest";
import { isSubtitledOnly } from "./mediaAudio";

describe("isSubtitledOnly", () => {
  it("flags a title with no track in the preferred language", () => {
    expect(isSubtitledOnly(["en", "ko"], "pt-BR")).toBe(true);
  });

  it("stays silent when any track speaks the preferred language", () => {
    expect(isSubtitledOnly(["en", "pt"], "pt-BR")).toBe(false);
  });

  it("compares a bare preference on the language alone", () => {
    expect(isSubtitledOnly(["en"], "en")).toBe(false);
    expect(isSubtitledOnly(["ja"], "en")).toBe(true);
  });

  it("stays silent when an untagged track could be the dub", () => {
    expect(isSubtitledOnly(["en", "un"], "pt-BR")).toBe(false);
  });

  it("stays silent without probed tracks", () => {
    expect(isSubtitledOnly([], "pt-BR")).toBe(false);
    expect(isSubtitledOnly(undefined, "pt-BR")).toBe(false);
  });

  it("stays silent until the preference is known", () => {
    expect(isSubtitledOnly(["en"], undefined)).toBe(false);
  });
});
