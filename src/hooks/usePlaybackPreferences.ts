import { useCallback, useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────

/**
 * Language code used for the audio/subtitle track preference.
 *
 * Deliberately typed as a plain string instead of a union so the
 * Settings dropdown can add or remove options later without
 * breaking the type. The matching logic in the player normalizes
 * values case-insensitively and strips region tags, so "pt-BR",
 * "pt", "por" and "pt_BR" all resolve to the same bucket.
 */
export type PreferredLanguage = string;

/**
 * When auto-pick subtitles should turn on.
 *
 * - `always`: always enable the best matching subtitle track on
 *   first play of a new media, regardless of the audio track.
 * - `foreignOnly`: enable subtitles only when the selected audio
 *   track's language differs from `subtitleLang`. This matches
 *   the common "I only need subs when I don't speak the audio"
 *   mental model.
 * - `forcedOnly`: only enable subtitle tracks flagged as forced
 *   (usually signs / foreign dialogue embedded in a same-language
 *   release). We still fall back to `off` if no forced track
 *   exists in the manifest.
 * - `off`: never auto-enable subtitles; the user has to pick one
 *   manually from the player menu.
 */
export type SubtitleMode = "always" | "foreignOnly" | "forcedOnly" | "off";

/**
 * Default quality the player should try to pick on first load
 * of a new media.
 *
 * - `best`: honor the current file-variant default chain (primary
 *   file → first file). This is the pre-preferences behavior and
 *   the factory default.
 * - Any resolution literal (e.g. `"1080p"`, `"720p"`): pick that
 *   resolution when the media exposes it; otherwise silently fall
 *   through to the "best" chain.
 */
export type DefaultQuality = "best" | string;

/**
 * Full set of playback preferences persisted per-device in
 * localStorage. Per-device (not per-user) is the right granularity
 * because these values reflect hardware (screen size, preferred
 * quality) and environment (household language) more than account
 * identity.
 */
export interface PlaybackPreferences {
  audioLang: PreferredLanguage;
  subtitleLang: PreferredLanguage;
  subtitleMode: SubtitleMode;
  defaultQuality: DefaultQuality;
  /**
   * Preferred playback speed (1 = normal). Persisted so binge-watchers
   * don't have to re-open the speed menu on every episode or movie.
   * Applied to the `<video>` element whenever a new HLS instance is
   * ready, alongside the audio/subtitle restore effect.
   */
  speed: number;
}

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = "homeflix-playback-prefs";

/**
 * Fallback values used when nothing is persisted yet OR when the
 * persisted blob is missing a field (forward-compat for future
 * additions). Kept as a frozen module constant so every consumer
 * gets the exact same reference — spreading it for the merge
 * creates a fresh copy at the edges.
 */
const DEFAULT_PREFS: Readonly<PlaybackPreferences> = Object.freeze({
  audioLang: "pt-BR",
  subtitleLang: "pt-BR",
  subtitleMode: "foreignOnly",
  defaultQuality: "best",
  speed: 1,
});

// ── Persistence ──────────────────────────────────────────────────

/**
 * Read the persisted preferences, merging any missing field with
 * `DEFAULT_PREFS`. Wrapped in a try/catch so private-mode or
 * quota-exceeded browsers don't crash the Settings page — in the
 * failure case the user gets the factory defaults and their
 * edits stop persisting, which is the correct degraded behavior.
 */
function loadPrefs(): PlaybackPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PlaybackPreferences>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs: PlaybackPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* persistence is best-effort */
  }
}

// ── Cross-tab sync ───────────────────────────────────────────────

/**
 * Module-level fan-out so multiple `usePlaybackPreferences`
 * instances in the same tab stay in sync after a write. Without
 * this, the Settings screen and the Player (which both subscribe)
 * would diverge for the lifetime of the tab because React state
 * updates don't cross component trees.
 *
 * The `storage` event handles cross-tab sync automatically for
 * us; this set covers the same-tab case.
 */
const listeners = new Set<(prefs: PlaybackPreferences) => void>();

function broadcast(prefs: PlaybackPreferences): void {
  listeners.forEach((fn) => fn(prefs));
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Shared playback-preferences hook.
 *
 * All subscribers see the same values — updating from Settings
 * immediately propagates to the Player (via the in-memory
 * `listeners` set) AND to other open tabs (via the browser's
 * `storage` event). Writes are debounced only by React's own
 * batching; localStorage is fast enough that sync writes on each
 * setter call are not measurable even on slow drives.
 *
 * Usage:
 *   const [prefs, setPrefs] = usePlaybackPreferences();
 *   setPrefs({ audioLang: "en" });   // partial update
 *
 * The partial-update contract lets Settings toggle one field at
 * a time without spelling out the whole blob, which keeps the
 * MUI `<Select onChange>` handlers one-liners.
 */
export function usePlaybackPreferences(): [
  PlaybackPreferences,
  (update: Partial<PlaybackPreferences>) => void,
] {
  // Lazy initializer so loadPrefs() only runs on the very first
  // render of each instance instead of on every re-render.
  const [prefs, setPrefsState] = useState<PlaybackPreferences>(loadPrefs);

  // Subscribe to same-tab updates. `setPrefsState` is stable so
  // the effect runs exactly once per mount; any unmount detaches
  // the listener so the set doesn't grow unboundedly over the
  // life of the tab.
  useEffect(() => {
    const onUpdate = (next: PlaybackPreferences) => setPrefsState(next);
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  // Subscribe to cross-tab updates. The browser dispatches
  // `storage` events only for OTHER tabs, so there's no feedback
  // loop with our own writes — we broadcast those through the
  // in-memory listener set instead.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setPrefsState(loadPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPrefs = useCallback(
    (update: Partial<PlaybackPreferences>) => {
      // Functional update so concurrent `setPrefs` calls (e.g. two
      // Selects changing in the same tick) merge onto the latest
      // value instead of racing against a stale `prefs` closure.
      setPrefsState((current) => {
        const next = { ...current, ...update };
        savePrefs(next);
        broadcast(next);
        return next;
      });
    },
    [],
  );

  return [prefs, setPrefs];
}
