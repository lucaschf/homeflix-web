import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "../api/auth";

/** The two interchangeable presentations of the episode selector. */
export type EpisodeSelectorView = "list" | "rail";

const STORAGE_PREFIX = "homeflix-episode-selector-view";

/**
 * The choice is persisted **per profile** — a kid profile on the TV
 * and an adult profile on the desktop want different defaults, and
 * the handoff calls for remembering it rather than re-asking.
 */
function storageKey(profileId: string | null): string {
  return profileId ? `${STORAGE_PREFIX}:${profileId}` : STORAGE_PREFIX;
}

function readView(key: string): EpisodeSelectorView {
  try {
    const raw = localStorage.getItem(key);
    return raw === "rail" || raw === "list" ? raw : "list";
  } catch {
    // Private-mode / disabled storage: fall back to the web default.
    return "list";
  }
}

export interface EpisodeSelectorController {
  /** Whether the selector is showing at all. */
  open: boolean;
  /** Persisted presentation choice. */
  view: EpisodeSelectorView;
  /** Season being browsed — starts on the playing one. */
  season: number;
  setView: (view: EpisodeSelectorView) => void;
  setSeason: (season: number) => void;
  toggle: () => void;
  close: () => void;
  /** Open *and* in list mode — the right-hand side panel. */
  isListOpen: boolean;
  /** Open *and* in rail mode — the bottom carousel over the video. */
  isRailOpen: boolean;
}

/**
 * Shared state for the in-player episode selector: open/closed, which
 * presentation, and which season is being browsed.
 *
 * Lives above both presentations so switching Lista ⇄ Carrossel keeps
 * the browsed season, and so the player can keep its controls pinned
 * while the rail is up (the rail renders inside the control bar).
 *
 * The list default is intentional: HomeFlix Web is mouse/keyboard
 * first, and the list scans better past ~20 episodes. The carousel is
 * the better pick on a TV, which is why the choice sticks per profile.
 */
export function useEpisodeSelector(currentSeason: number): EpisodeSelectorController {
  const { data: user } = useCurrentUser();
  const key = storageKey(user?.active_profile_id ?? null);

  const [view, setViewState] = useState<EpisodeSelectorView>(() => readView(key));
  // Re-read on profile switch: the key changes, the preference with it.
  useEffect(() => {
    setViewState(readView(key));
  }, [key]);

  const setView = useCallback(
    (next: EpisodeSelectorView) => {
      setViewState(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* best-effort */
      }
    },
    [key],
  );

  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState(currentSeason);

  // Opening (or advancing into another season) lands the selector on
  // the season being played, which is what the auto-scroll targets.
  useEffect(() => {
    if (open) setSeason(currentSeason);
  }, [open, currentSeason]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  return {
    open,
    view,
    season,
    setView,
    setSeason,
    toggle,
    close,
    isListOpen: open && view === "list",
    isRailOpen: open && view === "rail",
  };
}
