import { useQuery } from "@tanstack/react-query";
import { findFrame, parseThumbnailVtt, type ScrubFrame } from "./useScrubThumbnails";

// Pick a frame ~10% into the episode for the card thumbnail.
// Chosen empirically: far enough past blackness / studio idents to
// land on real content, before any title-card or branded intro
// frame that doesn't represent the actual episode.
const FRAME_TIME_RATIO = 0.1;

interface UseEpisodeScrubFrameArgs {
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  durationSeconds: number;
  /**
   * False short-circuits the fetch entirely. Pass false when the
   * episode has a real ``thumbnail_path`` so we never burn a request
   * to fall back to a frame we won't render.
   */
  enabled: boolean;
}

/**
 * Fetch the per-episode scrub-preview VTT and pick a single frame
 * to use as the card thumbnail when the episode has no first-class
 * ``thumbnail_path``. The result is cached so revisiting the same
 * series detail page doesn't re-fetch every episode's VTT.
 *
 * Returns ``null`` while loading and on any failure (404 because the
 * sprite hasn't been generated, network error, malformed VTT) — the
 * caller is expected to fall back to ``seriesPoster`` or a gradient.
 */
export function useEpisodeScrubFrame({
  seriesId,
  seasonNumber,
  episodeNumber,
  durationSeconds,
  enabled,
}: UseEpisodeScrubFrameArgs): ScrubFrame | null {
  const query = useQuery({
    queryKey: ["episode-scrub-frame", seriesId, seasonNumber, episodeNumber],
    queryFn: async (): Promise<ScrubFrame | null> => {
      const url = `/api/v1/stream/episode/${seriesId}/${seasonNumber}/${episodeNumber}/scrub-preview/sprite.vtt`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const text = await response.text();
      const frames = parseThumbnailVtt(text, response.url || url);
      if (frames.length === 0) return null;
      const target = durationSeconds * FRAME_TIME_RATIO;
      return findFrame(frames, target) ?? frames[0];
    },
    enabled,
    // Sprites don't change once generated; an hour is plenty for a
    // browsing session and avoids re-fetching every navigation.
    staleTime: 1000 * 60 * 60,
  });
  return query.data ?? null;
}
