import type { QualityChipKind } from "../components/QualityChip";

/**
 * Map a media item's best resolution + HDR flag to a `QualityChip`
 * label and kind. Returns `null` when no resolution is known (e.g.
 * series, whose quality is episode-derived and not surfaced yet), so
 * callers can skip the chip entirely.
 *
 * - 4K or any HDR → `premium`
 * - everything else → `neutral`
 */
export function mediaQuality(
  resolution: string | null | undefined,
  hdr: boolean | null | undefined,
): { label: string; kind: QualityChipKind } | null {
  if (!resolution) return null;
  const label = hdr ? `${resolution} HDR` : resolution;
  const is4k = resolution === "4K" || resolution === "2160p";
  const kind: QualityChipKind = is4k || hdr ? "premium" : "neutral";
  return { label, kind };
}
