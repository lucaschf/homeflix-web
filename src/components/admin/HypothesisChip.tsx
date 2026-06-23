import { Box, alpha, useTheme } from "@mui/material";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { fontFamily } from "../../theme/tokens";

interface HypothesisChipProps {
  children: ReactNode;
}

/**
 * Inline marker used on page headers to flag UI decisions made
 * while a backend contract is still in flux. Mirrors the design
 * spec's "Hipótese · …" affordance — peach pill with an info icon,
 * monospaced + uppercased label.
 *
 * Use sparingly; remove once the underlying decision is locked in.
 */
export function HypothesisChip({ children }: HypothesisChipProps) {
  const theme = useTheme();
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        py: 0.4,
        px: 1,
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
        borderRadius: 999,
        fontFamily: fontFamily.mono,
        fontSize: "0.5625rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "primary.main",
        lineHeight: 1,
      }}
    >
      <Info size={11} aria-hidden />
      <Box component="span">Hipótese · {children}</Box>
    </Box>
  );
}
