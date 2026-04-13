import { useCallback, useMemo } from "react";
import { usePreferencesQuery, useUpdatePreferences } from "../api/hooks";
import type { PlaybackPreferencesData } from "../api/types";

// ── Types ────────────────────────────────────────────────────────

export type PreferredLanguage = string;

export type SubtitleMode = "always" | "foreignOnly" | "forcedOnly" | "off";

export type DefaultQuality = "best" | string;

/**
 * Full set of playback preferences. Uses camelCase field names
 * throughout the frontend; the hook translates to/from the
 * snake_case API contract under the hood.
 */
export interface PlaybackPreferences {
  audioLang: PreferredLanguage;
  subtitleLang: PreferredLanguage;
  subtitleMode: SubtitleMode;
  defaultQuality: DefaultQuality;
  speed: number;
}

// ── Defaults ─────────────────────────────────────────────────────

const DEFAULT_PREFS: Readonly<PlaybackPreferences> = Object.freeze({
  audioLang: "pt-BR",
  subtitleLang: "pt-BR",
  subtitleMode: "foreignOnly",
  defaultQuality: "best",
  speed: 1,
});

// ── localStorage cache ───────────────────────────────────────────
// Kept as a write-through cache so the very first render (before
// the TanStack Query resolves) shows the last-known values instead
// of the factory defaults. Also acts as an offline fallback if the
// backend is unreachable.

const STORAGE_KEY = "homeflix-playback-prefs";

function loadCached(): PlaybackPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PlaybackPreferences>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function saveCache(prefs: PlaybackPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort */
  }
}

// ── snake ↔ camel translation ────────────────────────────────────

function fromApi(data: PlaybackPreferencesData): PlaybackPreferences {
  return {
    audioLang: data.audio_lang,
    subtitleLang: data.subtitle_lang,
    subtitleMode: data.subtitle_mode as SubtitleMode,
    defaultQuality: data.default_quality,
    speed: data.speed,
  };
}

function toApi(
  update: Partial<PlaybackPreferences>,
): Partial<PlaybackPreferencesData> {
  const result: Partial<PlaybackPreferencesData> = {};
  if (update.audioLang !== undefined) result.audio_lang = update.audioLang;
  if (update.subtitleLang !== undefined) result.subtitle_lang = update.subtitleLang;
  if (update.subtitleMode !== undefined) result.subtitle_mode = update.subtitleMode;
  if (update.defaultQuality !== undefined) result.default_quality = update.defaultQuality;
  if (update.speed !== undefined) result.speed = update.speed;
  return result;
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Backend-backed playback preferences with localStorage cache.
 *
 * Source of truth: `GET /api/v1/preferences` via TanStack Query.
 * Writes: `PUT /api/v1/preferences` with optimistic cache update.
 * First render: localStorage cache (instant, no loading flash).
 *
 * The public contract is unchanged from the old localStorage-only
 * implementation — `[prefs, setPrefs]` with partial updates — so
 * neither Settings.tsx nor Player.tsx needed changes.
 */
export function usePlaybackPreferences(): [
  PlaybackPreferences,
  (update: Partial<PlaybackPreferences>) => void,
] {
  const { data: apiData } = usePreferencesQuery();
  const mutation = useUpdatePreferences();

  // Merge order: API data (source of truth) > localStorage cache
  // > factory defaults. The useMemo keeps the reference stable
  // across renders where nothing actually changed.
  const prefs = useMemo<PlaybackPreferences>(() => {
    if (apiData) {
      const converted = fromApi(apiData);
      saveCache(converted);
      return converted;
    }
    return loadCached();
  }, [apiData]);

  const setPrefs = useCallback(
    (update: Partial<PlaybackPreferences>) => {
      // Optimistic local update so the UI feels instant.
      const next = { ...prefs, ...update };
      saveCache(next);
      // Fire the API mutation — the onSuccess handler in
      // useUpdatePreferences sets the query cache so every
      // subscriber picks up the response without a refetch.
      mutation.mutate(toApi(update));
    },
    [prefs, mutation],
  );

  return [prefs, setPrefs];
}
