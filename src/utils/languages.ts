import type { MediaFileOutput } from "../api/types";

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
};

const UNKNOWN_CODE = "un";

export function formatLanguage(code: string): string {
  const normalized = code.toLowerCase();
  return LANGUAGE_NAMES[normalized] ?? normalized.toUpperCase();
}

export function uniqueLanguages(
  files: MediaFileOutput[],
): { audio: string[]; subtitle: string[] } {
  const audioSet = new Set<string>();
  const subtitleSet = new Set<string>();
  for (const f of files) {
    for (const t of f.audio_tracks ?? []) {
      const lang = t.language?.toLowerCase();
      if (lang && lang !== UNKNOWN_CODE) audioSet.add(lang);
    }
    for (const t of f.subtitle_tracks ?? []) {
      const lang = t.language?.toLowerCase();
      if (lang && lang !== UNKNOWN_CODE) subtitleSet.add(lang);
    }
  }
  return { audio: [...audioSet], subtitle: [...subtitleSet] };
}
