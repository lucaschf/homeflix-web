import type {
  SubtitleFontSize,
  SubtitleTextEdge,
} from "../hooks/usePlaybackPreferences";

/**
 * CSS mappings for the subtitle appearance tiers, shared by the player
 * overlay and the Settings live preview so the two never drift.
 */

// Player overlay sizes: viewport-scaled so a tier reads the same on a phone
// and a TV. clamp() keeps a floor/ceiling.
export const subtitlePlayerFontSize: Record<SubtitleFontSize, string> = {
  small: "clamp(0.9rem, 2.2vw, 1.6rem)",
  medium: "clamp(1.1rem, 2.8vw, 2.2rem)",
  large: "clamp(1.4rem, 3.6vw, 3rem)",
  xlarge: "clamp(1.8rem, 4.6vw, 4rem)",
};

// Preview sizes: fixed and modest so all three fit the small Settings box
// while still conveying the relative difference.
export const subtitlePreviewFontSize: Record<SubtitleFontSize, string> = {
  small: "0.95rem",
  medium: "1.25rem",
  large: "1.6rem",
  xlarge: "2rem",
};

// Glyph edge treatments via text-shadow so they work on any background: a
// soft drop shadow (default) or a hard black outline traced in 8 directions
// for readability over bright frames.
export const subtitleTextEdgeCss: Record<SubtitleTextEdge, string> = {
  none: "none",
  shadow: "0 1px 2px rgba(0, 0, 0, 0.85)",
  outline:
    "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000",
};
