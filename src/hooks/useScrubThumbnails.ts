import { useEffect, useState } from "react";

/**
 * Frame metadata for a single hover position on the seek bar.
 *
 * The backend bundles every thumbnail into one JPEG sprite and a VTT
 * file whose cues point at rectangles of that sprite via the
 * ``sprite.jpg#xywh=x,y,w,h`` media-fragment syntax. The hook below
 * fetches the VTT, resolves each cue's sprite URL against the VTT's
 * own URL so the frontend never has to know the ``path_hash``, and
 * returns a flat array the player can binary-search on hover.
 */
export interface ScrubFrame {
  startTime: number;
  endTime: number;
  spriteUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Parse an HH:MM:SS.mmm timestamp into seconds.
 *
 * Internal helper — tolerant of the few formats WebVTT allows
 * (``H:MM:SS.mmm`` or ``MM:SS.mmm``) and of missing milliseconds.
 * Returns ``null`` on anything it can't read so upstream code can
 * skip malformed cues rather than crashing.
 */
function parseTimestamp(text: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const ms = match[4] ? Number(match[4].padEnd(3, "0").slice(0, 3)) : 0;
  if ([hours, minutes, seconds, ms].some((n) => Number.isNaN(n))) return null;
  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

/**
 * Parse a WebVTT payload into ``ScrubFrame`` records.
 *
 * The VTT grammar ``xywh=x,y,w,h`` isn't part of the standard WebVTT
 * spec; it's the convention hls.js, video.js, and most thumbnail
 * plugins use to point at a sprite rectangle. The parser does a
 * minimal block walk (split on blank lines, look for ``-->`` in the
 * first non-WEBVTT line of a block) and only emits cues that have
 * both a valid time range and an ``#xywh=`` fragment.
 *
 * ``baseUrl`` is the absolute URL the VTT itself was fetched from;
 * each ``sprite.jpg`` reference gets resolved against it via the
 * ``URL`` constructor so the Player doesn't need the cache hash.
 */
export function parseThumbnailVtt(vtt: string, baseUrl: string): ScrubFrame[] {
  const frames: ScrubFrame[] = [];
  const blocks = vtt.replace(/\r\n/g, "\n").split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    // The first line of a cue block is either the timing line directly,
    // or an identifier followed by the timing line. ``WEBVTT`` and
    // ``NOTE`` blocks have no ``-->`` so they just fall through.
    const timingIndex = lines.findIndex((l) => l.includes("-->"));
    if (timingIndex < 0) continue;
    const timing = lines[timingIndex];
    const payload = lines.slice(timingIndex + 1).join("\n").trim();
    if (!payload) continue;

    const [startText, rest] = timing.split("-->");
    if (!rest) continue;
    const endText = rest.split(/\s+/).filter(Boolean)[0] ?? "";
    const start = parseTimestamp(startText);
    const end = parseTimestamp(endText);
    if (start === null || end === null) continue;

    const fragmentMatch = /^([^#]+)#xywh=(-?\d+),(-?\d+),(\d+),(\d+)/.exec(payload);
    if (!fragmentMatch) continue;
    const [, spriteRef, xs, ys, ws, hs] = fragmentMatch;
    let spriteUrl: string;
    try {
      spriteUrl = new URL(spriteRef, baseUrl).toString();
    } catch {
      continue;
    }

    frames.push({
      startTime: start,
      endTime: end,
      spriteUrl,
      x: Number(xs),
      y: Number(ys),
      width: Number(ws),
      height: Number(hs),
    });
  }
  return frames;
}

/**
 * Return the frame covering ``time``, or null when no frame matches.
 *
 * Linear scan — frame lists for a 2h movie at 10s granularity are
 * ~720 entries, well under any performance concern. If the movie
 * gets indexed at finer granularity this can become a binary search.
 */
export function findFrame(frames: ScrubFrame[], time: number): ScrubFrame | null {
  for (const frame of frames) {
    if (time >= frame.startTime && time < frame.endTime) return frame;
  }
  return frames.length > 0 && time >= frames[frames.length - 1].endTime
    ? frames[frames.length - 1]
    : null;
}

/**
 * Fetch and parse the thumbnail VTT for the cache bucket at ``vttUrl``.
 *
 * Returns ``[]`` until the fetch resolves so the Player can render
 * the normal seek bar without any preview. Every failure mode — the
 * sprite thread hasn't finished yet (404), network hiccup, malformed
 * VTT — collapses to "no previews this session" rather than surfacing
 * an error the user would see. This mirrors the backend's best-effort
 * stance: thumbs are nice-to-have, the player works without them.
 *
 * ``vttUrl`` of an empty string disables the effect entirely so the
 * caller can pass whatever they compute before the hash is known
 * without gating the component tree on a branch.
 */
export function useScrubThumbnails(vttUrl: string): ScrubFrame[] {
  const [frames, setFrames] = useState<ScrubFrame[]>([]);

  useEffect(() => {
    if (!vttUrl) {
      // Clear stale frames when the caller hides the URL (e.g. the
      // player is tearing down an episode). The updater form returns
      // the same reference when the array is already empty so React
      // skips the render, which keeps the effect idempotent even
      // though we're calling setState from inside it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFrames((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(vttUrl, { signal: controller.signal });
        if (!response.ok) return;
        const text = await response.text();
        if (cancelled) return;
        // Resolve sprite refs against the final URL (``response.url``)
        // so any redirect the backend may add later still works.
        setFrames(parseThumbnailVtt(text, response.url || vttUrl));
      } catch {
        // Abort or network error — silently keep frames empty.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [vttUrl]);

  return frames;
}
