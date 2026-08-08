import type { ContinueWatchingItem } from "../api/types";

/**
 * Find the episode to resume for a series from the Continue Watching
 * feed: the most recently watched in-progress episode belonging to that
 * series. Returns ``null`` when the series has no in-progress episode
 * (a fresh series), so callers can fall back to opening the detail page
 * where the first-episode / season picker lives.
 *
 * Used by the home / browse hero so a "Continuar" on a series slide
 * resumes playback in one click instead of routing through the detail
 * page. It intentionally only knows the Continue Watching feed (no
 * season structure), so it can't pick a *first* episode for a fresh
 * series — that stays a detail-page concern.
 */
export function findResumeEpisode(
  continueWatching: ContinueWatchingItem[] | undefined,
  seriesId: string,
): { season: number; episode: number } | null {
  if (!continueWatching) return null;

  let best: { season: number; episode: number; lastWatched: string } | null = null;
  for (const item of continueWatching) {
    if (item.media_type !== "episode") continue;
    if (
      item.series_id === seriesId &&
      item.season_number != null &&
      item.episode_number != null &&
      (!best || item.last_watched_at > best.lastWatched)
    ) {
      best = {
        season: item.season_number,
        episode: item.episode_number,
        lastWatched: item.last_watched_at,
      };
    }
  }

  return best ? { season: best.season, episode: best.episode } : null;
}
