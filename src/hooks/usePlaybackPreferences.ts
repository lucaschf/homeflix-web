import { useCallback, useMemo } from "react";
import { useCurrentUser } from "../api/auth";
import { usePreferencesQuery, useUpdatePreferences } from "../api/hooks";
import type { PlaybackPreferencesData } from "../api/types";

// ── Types ────────────────────────────────────────────────────────

export type PreferredLanguage = string;

export type SubtitleMode = "always" | "foreignOnly" | "forcedOnly" | "off";

export type DefaultQuality = "best" | string;

export type SubtitleFontSize = "small" | "medium" | "large" | "xlarge";

export type SubtitleTextEdge = "none" | "shadow" | "outline";

/**
 * What the player does when the playhead reaches the opening marker.
 *
 * ``autoAfterFirst`` is deliberately stateless: it reads the episode
 * number rather than counting skips, so "I want to hear the theme once
 * a season" holds however the viewer wanders through the season.
 *
 * The values are the API enum verbatim — the backend rejects anything
 * outside it, so the Settings select maps over ``INTRO_SKIP_MODES``
 * instead of spelling the strings out a second time.
 */
export const INTRO_SKIP_MODES = ["manual", "auto", "autoAfterFirst"] as const;
export type IntroSkipMode = (typeof INTRO_SKIP_MODES)[number];

/** What the player does when the end credits start rolling. */
export const CREDITS_SKIP_MODES = ["manual", "auto"] as const;
export type CreditsSkipMode = (typeof CREDITS_SKIP_MODES)[number];

/** How subtitles look in the player overlay. */
export interface SubtitleAppearance {
  /** Text color — any CSS color value. */
  color: string;
  /** Background color behind the text — typically semi-transparent. */
  background: string;
  /** Relative font size the player scales to the viewport. */
  fontSize: SubtitleFontSize;
  /** Glyph edge treatment for legibility over the picture. */
  textEdge: SubtitleTextEdge;
}

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
  subtitleAppearance: SubtitleAppearance;
  introSkipMode: IntroSkipMode;
  creditsSkipMode: CreditsSkipMode;
}

// ── Defaults ─────────────────────────────────────────────────────

export const DEFAULT_SUBTITLE_APPEARANCE: Readonly<SubtitleAppearance> =
  Object.freeze({
    color: "#FFFFFF",
    background: "rgba(0, 0, 0, 0.75)",
    fontSize: "medium",
    textEdge: "shadow",
  });

const DEFAULT_PREFS: Readonly<PlaybackPreferences> = Object.freeze({
  audioLang: "pt-BR",
  subtitleLang: "pt-BR",
  subtitleMode: "foreignOnly",
  defaultQuality: "best",
  speed: 1,
  subtitleAppearance: DEFAULT_SUBTITLE_APPEARANCE,
  // Both default to "manual": nothing in the player moves on its own
  // until the viewer asks for it in Settings.
  introSkipMode: "manual",
  creditsSkipMode: "manual",
});

// ── localStorage cache ───────────────────────────────────────────
// Kept as a write-through cache so the very first render (before
// the TanStack Query resolves) shows the last-known values instead
// of the factory defaults. Also acts as an offline fallback if the
// backend is unreachable.
//
// Namespaced by profile: preferences are per-profile server-side, and
// switching profiles clears the query cache, so a single shared key
// would hand the incoming viewer the outgoing one's settings for the
// render or two before ``GET /preferences`` answers. With no active
// profile yet there is nothing to key on and the factory defaults
// stand in — one render of "manual" is the safe way to be wrong.

const STORAGE_PREFIX = "homeflix-playback-prefs";

/** Pre-profile key, superseded by the namespaced ones. */
const LEGACY_STORAGE_KEY = STORAGE_PREFIX;

function storageKey(profileId: string | null | undefined): string | null {
  return profileId ? `${STORAGE_PREFIX}:${profileId}` : null;
}

function loadCached(profileId: string | null | undefined): PlaybackPreferences {
  const key = storageKey(profileId);
  if (!key) return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PlaybackPreferences>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function saveCache(
  profileId: string | null | undefined,
  prefs: PlaybackPreferences,
): void {
  const key = storageKey(profileId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}

// ── snake ↔ camel translation ────────────────────────────────────

/**
 * Narrow an API enum string to its union, falling back to the default
 * for anything unexpected — an older backend that omits the field, or
 * a value added server-side that this build doesn't render yet.
 */
function oneOf<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function fromApi(data: PlaybackPreferencesData): PlaybackPreferences {
  const appearance = data.subtitle_appearance;
  return {
    audioLang: data.audio_lang,
    subtitleLang: data.subtitle_lang,
    subtitleMode: data.subtitle_mode as SubtitleMode,
    defaultQuality: data.default_quality,
    speed: data.speed,
    // Guard against a legacy response predating the appearance field.
    subtitleAppearance: appearance
      ? {
          color: appearance.color,
          background: appearance.background,
          fontSize: appearance.font_size,
          textEdge: appearance.text_edge ?? DEFAULT_SUBTITLE_APPEARANCE.textEdge,
        }
      : { ...DEFAULT_SUBTITLE_APPEARANCE },
    introSkipMode: oneOf(
      INTRO_SKIP_MODES,
      data.intro_skip_mode,
      DEFAULT_PREFS.introSkipMode,
    ),
    creditsSkipMode: oneOf(
      CREDITS_SKIP_MODES,
      data.credits_skip_mode,
      DEFAULT_PREFS.creditsSkipMode,
    ),
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
  if (update.subtitleAppearance !== undefined) {
    result.subtitle_appearance = {
      color: update.subtitleAppearance.color,
      background: update.subtitleAppearance.background,
      font_size: update.subtitleAppearance.fontSize,
      text_edge: update.subtitleAppearance.textEdge,
    };
  }
  if (update.introSkipMode !== undefined) result.intro_skip_mode = update.introSkipMode;
  if (update.creditsSkipMode !== undefined) {
    result.credits_skip_mode = update.creditsSkipMode;
  }
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
  const { data: user } = useCurrentUser();
  const mutation = useUpdatePreferences();
  const profileId = user?.active_profile_id ?? null;

  // Merge order: API data (source of truth) > localStorage cache
  // > factory defaults. The useMemo keeps the reference stable
  // across renders where nothing actually changed.
  const prefs = useMemo<PlaybackPreferences>(() => {
    if (apiData) {
      const converted = fromApi(apiData);
      saveCache(profileId, converted);
      return converted;
    }
    return loadCached(profileId);
  }, [apiData, profileId]);

  const setPrefs = useCallback(
    (update: Partial<PlaybackPreferences>) => {
      // Optimistic local update so the UI feels instant.
      const next = { ...prefs, ...update };
      saveCache(profileId, next);
      // Fire the API mutation — the onSuccess handler in
      // useUpdatePreferences sets the query cache so every
      // subscriber picks up the response without a refetch.
      mutation.mutate(toApi(update));
    },
    [prefs, mutation, profileId],
  );

  return [prefs, setPrefs];
}
