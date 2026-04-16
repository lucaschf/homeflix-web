const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  ru: "Русский",
  ar: "العربية",
  nl: "Nederlands",
  pl: "Polski",
  sv: "Svenska",
  no: "Norsk",
  da: "Dansk",
  fi: "Suomi",
  tr: "Türkçe",
  el: "Ελληνικά",
  cs: "Čeština",
  hu: "Magyar",
  ro: "Română",
  uk: "Українська",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  he: "עברית",
  hi: "हिन्दी",
  un: "Unknown",
};

export function formatLanguage(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

export function uniqueLanguages(
  files: { audio_tracks?: { language: string }[]; subtitle_tracks?: { language: string }[] }[],
): { audio: string[]; subtitle: string[] } {
  const audioSet = new Set<string>();
  const subtitleSet = new Set<string>();
  for (const f of files) {
    for (const t of f.audio_tracks ?? []) audioSet.add(t.language);
    for (const t of f.subtitle_tracks ?? []) subtitleSet.add(t.language);
  }
  return {
    audio: [...audioSet].filter((l) => l !== "un"),
    subtitle: [...subtitleSet].filter((l) => l !== "un"),
  };
}
