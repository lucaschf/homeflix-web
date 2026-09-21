import { Fragment, useMemo } from "react";
import { Box, Typography, type TypographyProps } from "@mui/material";
import { fontFamily, scrim } from "../theme/tokens";
import { LOCKUP_LINE_HEIGHT, LOGO_FRAME, titleLockup, type LockupFrame } from "./titleLockup";

type TitleLockupTextProps = Omit<TypographyProps, "children"> & {
  title: string;
  /** The space the lockup is set in; the logo box by default. */
  frame?: LockupFrame;
};

/**
 * A title set as a logo would be (see ``titleLockup``): all caps in the
 * display face, each line sized in ``cqi`` — a fraction of this
 * element's own width — so the lockup fills whatever width it's given.
 * The lines are separate blocks with a space between them, so the text
 * still reads as one title. Size the element's width; everything else
 * follows from it.
 */
export function TitleLockupText({ title, frame = LOGO_FRAME, sx, ...props }: TitleLockupTextProps) {
  const { lines, sizes } = useMemo(() => titleLockup(title, frame), [title, frame]);
  return (
    <Typography
      // The lines may drop a separator dash; the name keeps the title whole.
      aria-label={title}
      {...props}
      sx={[
        {
          containerType: "inline-size",
          fontFamily: fontFamily.display,
          fontWeight: 800,
          letterSpacing: 0,
          textTransform: "uppercase",
          color: "common.white",
          // Lifts the letters off a bright backdrop, as a logo's own art does.
          textShadow: `0 2px 24px ${scrim(0.45)}`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <Box
            component="span"
            sx={{
              display: "block",
              whiteSpace: "nowrap",
              fontSize: `${(sizes[i] * 100).toFixed(2)}cqi`,
              lineHeight: LOCKUP_LINE_HEIGHT,
            }}
          >
            {line}
          </Box>
        </Fragment>
      ))}
    </Typography>
  );
}
