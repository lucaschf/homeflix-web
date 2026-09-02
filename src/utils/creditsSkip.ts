import type { CreditsSkipMode } from "../hooks/usePlaybackPreferences";

/**
 * Which end-of-title surface the player raises, and whether it moves
 * on its own.
 *
 * There is one auto-advance path in the player, not two: the credits
 * marker and the native ``ended`` event both land here, and the
 * profile's ``credits_skip_mode`` governs which surface they get.
 */
export type EndOfTitleAction =
  /** Nothing to advance to — the post-play suggestion panel takes over. */
  | "postPlay"
  /** Start the countdown that rolls into the next episode. */
  | "autoAdvance"
  /** Show the next-episode card and wait for the click. */
  | "prompt";

interface EndOfTitleContext {
  isMovie: boolean;
  /** False on the last episode of the last season. */
  hasNextEpisode: boolean;
  mode: CreditsSkipMode;
}

/**
 * Playback reached the detected credits onset.
 *
 * A movie, or the last episode of a series, has nowhere to advance to:
 * both modes collapse onto the post-play panel, which never moves on
 * its own.
 */
export function creditsOnsetAction({
  isMovie,
  hasNextEpisode,
  mode,
}: EndOfTitleContext): EndOfTitleAction {
  if (isMovie || !hasNextEpisode) return "postPlay";
  return mode === "auto" ? "autoAdvance" : "prompt";
}

/**
 * The file ran out — the fallback path for titles the credits detector
 * hasn't marked, and the backstop for the ones it has.
 *
 * Without a marker the preference never had an onset to act on, so the
 * pre-existing end-of-file auto-advance stands: a profile that turns
 * nothing on must see nothing change on an unmarked episode.
 */
export function playbackEndedAction({
  isMovie,
  hasNextEpisode,
  mode,
  hasCreditsMarker,
}: EndOfTitleContext & { hasCreditsMarker: boolean }): EndOfTitleAction {
  if (isMovie || !hasNextEpisode) return "postPlay";
  if (!hasCreditsMarker) return "autoAdvance";
  return mode === "auto" ? "autoAdvance" : "prompt";
}
