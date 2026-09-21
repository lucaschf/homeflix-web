import { Box } from "@mui/material";
import { artworkSrcSet } from "../utils/artwork";

/**
 * Header backdrop for a title with no backdrop art: its poster blown up
 * past the frame, blurred and dimmed into a colour field. The header
 * carries the film's palette without a second image competing with the
 * title. Blurred this far, the smallest poster rung is plenty.
 *
 * Fills its parent, which must clip overflow — the scale pushes the
 * blur's soft edges outside the frame.
 */
export function PosterBackdrop({ posterPath }: { posterPath: string }) {
  return (
    <Box
      component="img"
      {...artworkSrcSet(posterPath, "poster")}
      sizes="342px"
      alt=""
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: "blur(48px) saturate(1.3) brightness(0.6)",
        transform: "scale(1.25)",
      }}
    />
  );
}
