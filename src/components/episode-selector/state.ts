import type { EpisodeOutput, SeasonOutput } from "../../api/types";

/**
 * State language of the in-player episode selector, per the design
 * handoff (`specs/design_handoff_episode_selector`).
 *
 * The point of the redesign: **watched is the recessive state**. A
 * check on every row carries no information, so a finished episode
 * dims and steps back while an unwatched one keeps a full-brightness
 * still — absence is the signal.
 */
export type EpisodeState = "playing" | "inProgress" | "watched" | "new";

/** Which of the four visual states an episode is in. */
export function episodeStateOf(
  episode: EpisodeOutput,
  playing: boolean,
): EpisodeState {
  if (playing) return "playing";
  if (episode.watch_status === "completed") return "watched";
  return (episode.progress_percentage ?? 0) > 0 ? "inProgress" : "new";
}

/**
 * Thumbnail fallback chain: per-episode still → series poster → none
 * (the caller paints a gradient placeholder). Deliberately does *not*
 * reach for scrub-preview frames the way ``EpisodeCard`` does — a
 * season of 24 episodes would fire 24 VTT fetches while a stream is
 * already saturating the connection.
 */
export function episodeThumbnail(
  episode: EpisodeOutput,
  seriesPoster: string | null,
): string | null {
  return episode.thumbnail_path ?? seriesPoster ?? null;
}

/** Completed episodes in a season — drives the header's watched count. */
export function watchedCount(season: SeasonOutput | undefined): number {
  if (!season) return 0;
  return season.episodes.filter((e) => e.watch_status === "completed").length;
}

// -- Sizing (px, straight from the handoff) -----------------------------------

/** Side panel width. Below 440 the synopses hard-crop — do not shrink. */
export const PANEL_WIDTH = 460;
/** List thumbnail: 149 x 84 at the comfortable density. */
export const LIST_THUMB_WIDTH = 149;
/** Rail card width on desktop; the thumb is width x 9/16. */
export const RAIL_CARD_WIDTH = 300;
/** Rail card width below the `sm` breakpoint. */
export const RAIL_CARD_WIDTH_COMPACT = 220;
/** Reserved height of one synopsis line — the slot never reflows. */
export const SYNOPSIS_LINE_HEIGHT = 17;
