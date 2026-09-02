import type { IntroSkipMode } from "../hooks/usePlaybackPreferences";

/**
 * Auto-skip of the opening sequence, as a state machine the player
 * feeds playhead samples and seek notifications.
 *
 * The server publishes the marker and the preference; it has no
 * playhead and skips nothing. Everything about *when* to move lives
 * here, deliberately outside React so the interesting part — natural
 * entry versus a deliberate seek, one skip per playback — is testable
 * without mounting a video element.
 *
 * Marker seconds are episode-relative, the same coordinate system the
 * player already uses for watch progress and the Skip Intro button, so
 * nothing in here converts anything.
 */

/** The episode-relative window an opening sequence occupies. */
export interface IntroWindow {
  start_seconds: number;
  end_seconds: number;
}

/**
 * Whether the mode means "move the playhead on its own" for this
 * episode.
 *
 * ``autoAfterFirst`` reads the episode number rather than counting
 * skips within a session: the point is to hear the theme once per
 * season, and a viewer who restarts an episode, changes device, or
 * comes back a week later should get the same answer.
 */
export function autoSkipsIntro(mode: IntroSkipMode, episodeNumber: number): boolean {
  switch (mode) {
    case "auto":
      return true;
    case "autoAfterFirst":
      return episodeNumber > 1;
    default:
      return false;
  }
}

/** End is exclusive — at ``end_seconds`` the opening is already over. */
export function isInsideIntro(intro: IntroWindow, position: number): boolean {
  return position >= intro.start_seconds && position < intro.end_seconds;
}

export interface IntroSkipState {
  /**
   * An auto-skip has already fired (or was explicitly spent) in this
   * playback. Without this the player would drag the viewer back out
   * every time they returned to the opening, which makes re-watching
   * it impossible.
   */
  consumed: boolean;
  /**
   * The playhead is inside the window because someone put it there.
   * Dragging the bar into the opening is an explicit "I want to watch
   * this"; cleared as soon as the playhead leaves the window again.
   */
  suppressed: boolean;
}

export function createIntroSkipState(): IntroSkipState {
  return { consumed: false, suppressed: false };
}

/**
 * Record a seek the viewer asked for — the scrub bar, the ±10s/30s
 * controls, the keyboard arrows. Resume-position restores and the
 * auto-skip's own seek must NOT go through here: landing inside the
 * opening because that is where watching left off is exactly the case
 * that should skip.
 */
export function observeSeek(
  state: IntroSkipState,
  target: number,
  intro: IntroWindow | null,
): IntroSkipState {
  const suppressed = intro !== null && isInsideIntro(intro, target);
  if (suppressed === state.suppressed) return state;
  return { ...state, suppressed };
}

/** Spend the one skip this playback gets without moving the playhead. */
export function markIntroSkipConsumed(state: IntroSkipState): IntroSkipState {
  if (state.consumed) return state;
  return { ...state, consumed: true };
}

export interface IntroSkipSample {
  state: IntroSkipState;
  /** Where to seek, or ``null`` to leave the playhead alone. */
  skipTo: number | null;
}

/**
 * Feed the machine the current playhead position.
 *
 * A skip is due when the position sits inside the window, the mode
 * asks for one, this playback hasn't had one yet, and the viewer
 * didn't put the playhead there themselves. The first sample of a
 * playback counts as natural entry, which is what makes a resume that
 * lands mid-opening skip — and spend the playback's one skip.
 */
export function observePosition(
  state: IntroSkipState,
  position: number,
  intro: IntroWindow | null,
  autoEnabled: boolean,
): IntroSkipSample {
  if (intro === null || !isInsideIntro(intro, position)) {
    // Out of the window: whatever put the playhead inside it is over,
    // so a later natural entry is a fresh question again.
    const cleared = state.suppressed ? { ...state, suppressed: false } : state;
    return { state: cleared, skipTo: null };
  }
  if (!autoEnabled || state.consumed || state.suppressed) {
    return { state, skipTo: null };
  }
  return { state: { ...state, consumed: true }, skipTo: intro.end_seconds };
}
