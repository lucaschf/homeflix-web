import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  autoSkipsIntro,
  createIntroSkipState,
  markIntroSkipConsumed,
  observePosition,
  observeSeek,
  type IntroWindow,
} from "../utils/introSkip";
import type { IntroSkipMode } from "./usePlaybackPreferences";

interface UseIntroAutoSkipArgs {
  /** The episode's opening marker, or null when it has none. */
  intro: IntroWindow | null;
  mode: IntroSkipMode;
  /** Episode number within the season; 0 for a movie (never skips). */
  episodeNumber: number;
  /** Episode-relative playhead — the value the Skip Intro button reads. */
  position: number;
  /** False while the stream is still coming up, so a cold start can't skip. */
  active: boolean;
  /** Identity of what's playing; a change starts a fresh playback. */
  playbackKey: string;
  /** Called with the second to seek to when a skip is due. */
  onSkip: (target: number) => void;
}

export interface IntroAutoSkip {
  /**
   * The viewer moved the playhead themselves. Call this *before* the
   * seek so the position sample it produces is already classified —
   * a drag into the opening is a decision to watch it, not something
   * to undo.
   */
  notifySeek: (target: number) => void;
  /** Spend this playback's one skip (the Skip Intro button, "watch intro"). */
  notifyConsumed: () => void;
  /** Start over — a replay is a new playback of the same media. */
  reset: () => void;
}

/**
 * Drives the intro auto-skip state machine off the player's playhead.
 *
 * The player owns the seek; this hook only decides when one is due and
 * hands back the notifications the machine needs to tell a deliberate
 * jump from playback drifting into the opening.
 */
export function useIntroAutoSkip({
  intro,
  mode,
  episodeNumber,
  position,
  active,
  playbackKey,
  onSkip,
}: UseIntroAutoSkipArgs): IntroAutoSkip {
  const stateRef = useRef(createIntroSkipState());

  // The skip callback closes over the player's ``seekTo``, whose
  // identity changes with the bucket. Held in a ref so re-binding it
  // never re-runs the sampler below with a stale position.
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  // Declared before the sampler so a media change resets the machine
  // on the same commit that delivers the new episode's first sample.
  useEffect(() => {
    stateRef.current = createIntroSkipState();
  }, [playbackKey]);

  const autoEnabled = active && autoSkipsIntro(mode, episodeNumber);

  useEffect(() => {
    const { state, skipTo } = observePosition(
      stateRef.current,
      position,
      intro,
      autoEnabled,
    );
    stateRef.current = state;
    if (skipTo !== null) onSkipRef.current(skipTo);
  }, [position, intro, autoEnabled]);

  const notifySeek = useCallback(
    (target: number) => {
      stateRef.current = observeSeek(stateRef.current, target, intro);
    },
    [intro],
  );

  const notifyConsumed = useCallback(() => {
    stateRef.current = markIntroSkipConsumed(stateRef.current);
  }, []);

  const reset = useCallback(() => {
    stateRef.current = createIntroSkipState();
  }, []);

  return useMemo(
    () => ({ notifySeek, notifyConsumed, reset }),
    [notifySeek, notifyConsumed, reset],
  );
}
