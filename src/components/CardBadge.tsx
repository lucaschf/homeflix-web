import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { fontFamily, scrim, whiteAlpha } from "../theme/tokens";

/**
 * ``accent`` draws the eye to something worth choosing a title for;
 * ``muted`` is a heads-up you'd want before pressing play.
 */
export type CardBadgeTone = "accent" | "muted";

interface CardBadgeProps {
  label: string;
  tone: CardBadgeTone;
}

/**
 * Corner marker for a media card (quality, subtitled-only), sized and
 * scrimmed to stay legible on top of poster art.
 *
 * Distinct from ``QualityChip`` on purpose: that one renders on an
 * opaque surface (the detail page's quality rail) and so gets away with
 * a transparent background, which would be unreadable over an image.
 */
export function CardBadge({ label, tone }: CardBadgeProps) {
  const theme = useTheme();
  const peach = theme.palette.primary.main;

  const toneSx =
    tone === "accent"
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
        ...toneSx,
      }}
    >
      {label}
    </Box>
  );
}
