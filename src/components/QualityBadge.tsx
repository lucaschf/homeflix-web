import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { fontFamily, scrim, whiteAlpha } from "../theme/tokens";
import type { QualityBadgeSpec } from "./mediaQuality";

/**
 * Quality marker for a media card, sized and scrimmed to stay legible
 * on top of poster art.
 *
 * Distinct from ``QualityChip`` on purpose: that one renders on an
 * opaque surface (the detail page's quality rail) and so gets away with
 * a transparent background, which would be unreadable over an image.
 */
export function QualityBadge({ label, kind }: QualityBadgeSpec) {
  const theme = useTheme();
  const peach = theme.palette.primary.main;

  const variantSx =
    kind === "premium"
      ? { color: peach, border: `1px solid ${alpha(peach, 0.45)}` }
      : { color: whiteAlpha(0.75), border: `1px solid ${whiteAlpha(0.18)}` };

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: fontFamily.mono,
        fontSize: "0.5625rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        padding: "2px 5px",
        borderRadius: "3px",
        whiteSpace: "nowrap",
        lineHeight: 1.3,
        backgroundColor: scrim(0.72),
        backdropFilter: "blur(2px)",
        ...variantSx,
      }}
    >
      {label}
    </Box>
  );
}
