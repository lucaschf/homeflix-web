import { Box } from "@mui/material";
import { neutral } from "../theme/colors";
import { peachAlpha, whiteAlpha } from "../theme/tokens";
import { TitleLockupText } from "./TitleLockupText";
import type { LockupFrame } from "./titleLockup";

type Shape = "poster" | "landscape";

/** Width of the lockup inside the card; the rest is margin. */
const LOCKUP_WIDTH = 0.8;

// Frames per card shape, as fractions of the lockup's width. A poster
// is tall, so any multi-word title stacks and keeps taking lines while
// that sets it bigger ("MAD / MAX"); a landscape still reads like the
// hero, one line when the title is short. Heights leave ~20% of the
// card as margin; a poster lets a short word grow bigger than the hero.
const FRAMES: Record<Shape, LockupFrame> = {
  poster: {
    maxHeight: (1.5 * 0.8) / LOCKUP_WIDTH,
    lineMax: 0.3,
    maxLines: 5,
    oneLineMin: Infinity,
    settleSize: Infinity,
  },
  landscape: {
    maxHeight: ((9 / 16) * 0.8) / LOCKUP_WIDTH,
    lineMax: 0.22,
    maxLines: 3,
    oneLineMin: 0.12,
    settleSize: 0.1,
  },
};

interface GeneratedPosterProps {
  title: string;
  shape: Shape;
  /** Class for the card's hover zoom — the same one a real image carries. */
  className?: string;
}

/**
 * Stand-in artwork for a card whose image is missing or failed to load:
 * the title set as a lockup, like the hero does for a title with no
 * logo, on a quiet poster ground lit by the theme accent. Fills its
 * parent, which owns the aspect ratio.
 */
export function GeneratedPoster({ title, shape, className }: GeneratedPosterProps) {
  return (
    <Box
      role="img"
      aria-label={title}
      className={className}
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Accent light from the top falling off into the page tone, so
        // it reads as art rather than a loading skeleton.
        background: `radial-gradient(140% 90% at 50% -10%, ${peachAlpha(0.42)} 0%, ${peachAlpha(0.12)} 45%, transparent 75%), linear-gradient(180deg, ${neutral[800]} 0%, ${neutral[950]} 100%)`,
        boxShadow: `inset 0 0 0 1px ${whiteAlpha(0.06)}`,
        transition: "transform 250ms ease",
      }}
    >
      <TitleLockupText
        component="span"
        aria-hidden
        title={title}
        frame={FRAMES[shape]}
        sx={{ display: "block", width: `${LOCKUP_WIDTH * 100}%`, textAlign: "center" }}
      />
    </Box>
  );
}
