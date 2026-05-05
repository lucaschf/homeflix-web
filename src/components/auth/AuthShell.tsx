import type { ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * Full-bleed dark surface used by every auth screen (login,
 * picker, manage profiles).
 *
 * Originally this also painted two stacked peach radial halos and
 * a subtle SVG grain to reproduce the cinematographic backdrop
 * from the Variação B mock. In practice on real displays the
 * halos read as visible discs against the dark background rather
 * than the soft "warm wash" the mock implied — and the user's
 * household HBO reference is plain dark, no atmosphere — so the
 * decorative layers were removed. The shell is now a flat dark
 * canvas; bringing the halos back is one revert away if we ever
 * want them again.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}
