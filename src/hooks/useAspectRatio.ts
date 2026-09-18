import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ASPECT_MODES,
  nextAspectMode,
  type AspectMode,
} from "../utils/aspectRatio";

const STORAGE_PREFIX = "homeflix-aspect-ratio";

/**
 * The correction is remembered per *title*, not per profile.
 *
 * A stretched transfer is a property of the file, not a matter of
 * taste: it is wrong for everyone who plays it, and it is wrong for
 * every episode of the season it came from. Keying on the movie or
 * series means the viewer fixes a bad rip once instead of on every
 * episode, and a title that isn't broken is never affected.
 */
function storageKey(titleId: string): string | null {
  return titleId ? `${STORAGE_PREFIX}:${titleId}` : null;
}

function readMode(titleId: string): AspectMode {
  const key = storageKey(titleId);
  if (!key) return "auto";
  try {
    const raw = localStorage.getItem(key);
    return ASPECT_MODES.includes(raw as AspectMode) ? (raw as AspectMode) : "auto";
  } catch {
    // Private-mode / disabled storage: the picture is simply untouched.
    return "auto";
  }
}

export interface AspectRatioController {
  /** Shape currently forced on the picture. */
  mode: AspectMode;
  setMode: (mode: AspectMode) => void;
  /** Step to the next shape and return the one now in effect. */
  cycle: () => AspectMode;
}

/**
 * The player's picture-shape control: which display ratio is forced,
 * remembered per title.
 *
 * ``titleId`` is the movie or the *series* id — deliberately not the
 * episode, so the choice carries across a binge.
 */
export function useAspectRatio(titleId: string): AspectRatioController {
  const [mode, setModeState] = useState<AspectMode>(() => readMode(titleId));

  // Another title — including the navigation into the first one, since
  // the player is mounted before the route settles — re-reads the store.
  useEffect(() => {
    setModeState(readMode(titleId));
  }, [titleId]);

  const setMode = useCallback(
    (next: AspectMode) => {
      setModeState(next);
      const key = storageKey(titleId);
      if (!key) return;
      try {
        // ``auto`` is the default, so it is stored as the absence of a
        // row rather than as a value — otherwise every title ever
        // opened would leave one behind.
        if (next === "auto") localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        /* best-effort */
      }
    },
    [titleId],
  );

  const cycle = useCallback(() => {
    const next = nextAspectMode(mode);
    setMode(next);
    return next;
  }, [mode, setMode]);

  return useMemo(() => ({ mode, setMode, cycle }), [mode, setMode, cycle]);
}
