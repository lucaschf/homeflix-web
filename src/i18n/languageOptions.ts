/**
 * ISO codes accepted by the library audio / subtitle preferences.
 *
 * Picked from the languages the catalog most commonly ships with —
 * matches the set of audio + subtitle tracks the scanner has been
 * tagging across the user's library. Add a code here when a new
 * source language shows up; the dropdown picks the localized name
 * automatically through ``Intl.DisplayNames``.
 */
export const AUDIO_LANGUAGE_CODES = [
  "pt-BR",
  "pt-PT",
  "en",
  "es",
  "es-419",
  "fr",
  "de",
  "it",
  "ja",
  "ko",
  "zh-CN",
  "zh-TW",
  "ru",
  "ar",
  "hi",
  "tr",
  "nl",
  "sv",
  "da",
  "no",
  "fi",
  "pl",
  "cs",
  "el",
  "he",
  "th",
  "id",
  "uk",
] as const;

/**
 * Localized "Language X · code" option list keyed by the current
 * UI locale. The name comes from ``Intl.DisplayNames`` so the
 * dropdown reads "Português (Brasil) · pt-BR" in pt-BR and
 * "Portuguese (Brazil) · pt-BR" in en — no per-locale translation
 * table to maintain.
 *
 * Falls back to the raw code when ``Intl.DisplayNames`` can't
 * resolve a label (older browsers, missing data) so the option
 * stays usable even on the unhappy path.
 */
export function buildLanguageOptions(uiLocale: string): {
  value: string;
  label: string;
  meta: string;
}[] {
  let formatter: Intl.DisplayNames | null = null;
  try {
    formatter = new Intl.DisplayNames([uiLocale], { type: "language" });
  } catch {
    formatter = null;
  }
  return AUDIO_LANGUAGE_CODES.map((code) => {
    const name = formatter?.of(code) ?? code;
    return {
      value: code,
      label: name.charAt(0).toUpperCase() + name.slice(1),
      meta: code,
    };
  });
}
