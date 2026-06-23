import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { fontFamily, whiteAlpha } from "../theme/tokens";

export type QualityChipKind = "premium" | "neutral" | "low";
export type QualityChipSize = "sm" | "md";

interface QualityChipProps {
  label: string;
  kind?: QualityChipKind;
  size?: QualityChipSize;
}

export function QualityChip({ label, kind = "neutral", size = "md" }: QualityChipProps) {
  const theme = useTheme();
  const peach = theme.palette.primary.main;
  const isSm = size === "sm";

  const variantSx = {
    premium: {
      color: peach,
      border: `1px solid ${alpha(peach, 0.5)}`,
      backgroundColor: alpha(peach, 0.08),
    },
    neutral: {
      color: theme.palette.text.primary,
      border: `1px solid ${whiteAlpha(0.12)}`,
      backgroundColor: "transparent",
    },
    low: {
      color: theme.palette.text.secondary,
      border: `1px solid ${whiteAlpha(0.1)}`,
      backgroundColor: "transparent",
      opacity: 0.7,
    },
  }[kind];

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: fontFamily.mono,
        fontSize: isSm ? "0.5625rem" : "0.625rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        padding: isSm ? "2px 6px" : "3px 7px",
        borderRadius: "3px",
        whiteSpace: "nowrap",
        lineHeight: 1.3,
        ...variantSx,
      }}
    >
      {label}
    </Box>
  );
}
