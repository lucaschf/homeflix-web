import type { SeriesDetail } from "../api/types";

/**
 * Walking a series one episode at a time.
 *
 * Both directions go through the same function on purpose: "previous"
 * has to be "next" in reverse, including the awkward part — stepping
 * over a season boundary lands on the *first* episode of the next
 * season going forward and the *last* episode of the previous one going
 * back. Two hand-written mirrors of that would drift, and the bug they
 * produce (a key that skips an episode at a season edge) is invisible
 * until someone is actually at the edge.
 *
 * Season and episode numbers are sorted rather than trusted in array
 * order: the API returns what it has, and a series scanned out of order
 * would otherwise navigate out of order.
 */

export interface AdjacentEpisode {
  season: number;
  episode: number;
  /** ``S02E05 - Title``, or the bare label when there is no title. */
  title: string;
}

function label(season: number, episode: number, title: string): string {
  const code = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
  return title ? `${code} - ${title}` : code;
}

/**
 * The episode ``step`` places away — ``1`` for the next one, ``-1`` for
 * the previous — or ``null`` at either end of the series.
 */
export function adjacentEpisode(
  series: SeriesDetail | undefined,
  seasonNumber: number,
  episodeNumber: number,
  step: 1 | -1,
): AdjacentEpisode | null {
  if (!series) return null;

  const seasons = [...series.seasons].sort((a, b) => a.season_number - b.season_number);
  const seasonIdx = seasons.findIndex((s) => s.season_number === seasonNumber);
  if (seasonIdx < 0) return null;

  const episodes = [...seasons[seasonIdx].episodes].sort(
    (a, b) => a.episode_number - b.episode_number,
  );
  const episodeIdx = episodes.findIndex((e) => e.episode_number === episodeNumber);

  // Within the season.
  if (episodeIdx >= 0) {
    const sibling = episodes[episodeIdx + step];
    if (sibling) {
      return {
        season: seasonNumber,
        episode: sibling.episode_number,
        title: label(seasonNumber, sibling.episode_number, sibling.title),
      };
    }
  }

  // Either the season ran out or the episode number isn't in it (a bad
  // URL, or metadata that moved under the viewer). Both land on the far
  // edge of the neighbouring season — which is what auto-advance did
  // before this was a function, and changing it is not this refactor's
  // business.
  const neighbour = seasons[seasonIdx + step];
  if (!neighbour) return null;

  const neighbourEpisodes = [...neighbour.episodes].sort(
    (a, b) => a.episode_number - b.episode_number,
  );
  const edge = step === 1 ? neighbourEpisodes[0] : neighbourEpisodes[neighbourEpisodes.length - 1];
  if (!edge) return null;

  return {
    season: neighbour.season_number,
    episode: edge.episode_number,
    title: label(neighbour.season_number, edge.episode_number, edge.title),
  };
}
