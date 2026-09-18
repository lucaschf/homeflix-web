import { describe, expect, it } from "vitest";
import type { EpisodeOutput, SeasonOutput, SeriesDetail } from "../api/types";
import { adjacentEpisode } from "./episodeNavigation";

function episode(number: number, title = ""): EpisodeOutput {
  return {
    id: `epi_${number}`,
    episode_number: number,
    title,
    synopsis: null,
    duration_seconds: 1200,
    duration_formatted: "20m",
    file_path: null,
    file_size: null,
    resolution: null,
  } as EpisodeOutput;
}

function season(number: number, episodes: readonly number[]): SeasonOutput {
  return {
    id: `sea_${number}`,
    season_number: number,
    title: null,
    synopsis: null,
    poster_path: null,
    air_date: null,
    episode_count: episodes.length,
    episodes: episodes.map((n) => episode(n)),
  } as SeasonOutput;
}

/** Seasons and episodes deliberately out of order — the API's order is not the show's. */
const SERIES = {
  seasons: [season(2, [3, 1, 2]), season(1, [2, 1])],
} as SeriesDetail;

describe("adjacentEpisode", () => {
  it("steps within a season, in number order", () => {
    expect(adjacentEpisode(SERIES, 1, 1, 1)).toMatchObject({ season: 1, episode: 2 });
    expect(adjacentEpisode(SERIES, 2, 2, -1)).toMatchObject({ season: 2, episode: 1 });
  });

  it("crosses into the first episode of the next season", () => {
    expect(adjacentEpisode(SERIES, 1, 2, 1)).toMatchObject({ season: 2, episode: 1 });
  });

  it("crosses back into the *last* episode of the previous season", () => {
    // The mirror image, and the one a hand-written "previous" gets wrong.
    expect(adjacentEpisode(SERIES, 2, 1, -1)).toMatchObject({ season: 1, episode: 2 });
  });

  it("stops at both ends of the series", () => {
    expect(adjacentEpisode(SERIES, 1, 1, -1)).toBeNull();
    expect(adjacentEpisode(SERIES, 2, 3, 1)).toBeNull();
  });

  it("labels the episode for the OSD", () => {
    const withTitles = {
      seasons: [season(1, [1]), { ...season(2, [1]), episodes: [episode(1, "Piloto")] }],
    } as SeriesDetail;
    expect(adjacentEpisode(withTitles, 1, 1, 1)?.title).toBe("S02E01 - Piloto");
    expect(adjacentEpisode(SERIES, 1, 1, 1)?.title).toBe("S01E02");
  });

  it("has nothing to say without a series, or off the end of one", () => {
    expect(adjacentEpisode(undefined, 1, 1, 1)).toBeNull();
    expect(adjacentEpisode(SERIES, 9, 1, 1)).toBeNull();
  });
});
