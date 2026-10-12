/**
 * Quality-badge derivation, split out of ``CardBadge.tsx`` so the
 * component file only exports components (Fast Refresh requirement) —
 * the same split ``mediaCardDimensions.ts`` makes for ``MediaCard``.
 */
import type { CardBadgeTone } from "./CardBadge";

/**
 * ``accent`` marks a title worth seeking out (4K / HDR); ``muted`` warns
 * that the only copy on disk is standard definition.
 */
export interface QualityBadgeSpec {
  label: string;
  tone: CardBadgeTone;
}

// Resolution names the backend reports as standard definition. Mirrors
// ``_SD_RESOLUTIONS`` on the ``Resolution`` value object.
const SD_RESOLUTIONS = new Set(["360p", "480p"]);

/**
 * Pick the card badge for a title, or ``null`` when there's nothing
 * worth saying.
 *
 * Deliberately silent on the common cases (720p / 1080p / 2K): a badge
 * on every poster is wallpaper, not information. Only the two ends of
 * the range earn one — 4K/HDR because you'd choose a title for it, SD
 * because you'd want to know before pressing play.
 *
 * @param resolution Resolution name as the API reports it (``"4K"``,
 *   ``"1080p"``, ``"Unknown"``…), or null when nothing has a file yet.
 * @param hdr Whether any variant behind the card is HDR.
 */
export function deriveQualityBadge(
  resolution: string | null | undefined,
  hdr: boolean | undefined,
): QualityBadgeSpec | null {
  if (resolution === "4K") {
    return { label: hdr ? "4K HDR" : "4K", tone: "accent" };
  }
  if (hdr) {
    return { label: "HDR", tone: "accent" };
  }
  if (resolution && SD_RESOLUTIONS.has(resolution)) {
    return { label: "SD", tone: "muted" };
  }
  return null;
}
