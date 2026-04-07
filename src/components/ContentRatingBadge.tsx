import { Box, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Brazilian content rating (classificacao indicativa) color mapping.
 * Based on DEJUS official colors.
 */
const RATING_CONFIG: Record<string, { bg: string; label?: string }> = {
  // Brazilian ratings
  L: { bg: "#0C9447" },
  "10": { bg: "#0191D4" },
  "12": { bg: "#F5D218" },
  "14": { bg: "#F0862A" },
  "16": { bg: "#E4202A" },
  "18": { bg: "#1D1815" },
  // US ratings
  G: { bg: "#0C9447" },
  PG: { bg: "#0191D4" },
  "PG-13": { bg: "#F5D218", label: "PG-13" },
  R: { bg: "#E4202A" },
  "NC-17": { bg: "#1D1815", label: "NC-17" },
  NR: { bg: "#616161", label: "NR" },
};

interface ContentRatingBadgeProps {
  rating: string;
  size?: number;
}

export function ContentRatingBadge({ rating, size = 28 }: ContentRatingBadgeProps) {
  const { t } = useTranslation();
  const config = RATING_CONFIG[rating];
  const bg = config?.bg ?? "rgba(255,255,255,0.2)";
  const label = config?.label ?? rating;
  const fontSize = label.length > 2 ? size * 0.32 : size * 0.46;
  const tooltip = t(`rating.${rating}`, { defaultValue: "" });

  const badge = (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "4px",
        bgcolor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: tooltip ? "help" : "default",
      }}
    >
      <Typography
        sx={{
          color: "#fff",
          fontWeight: 800,
          fontSize,
          lineHeight: 1,
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        {label}
      </Typography>
    </Box>
  );

  if (!tooltip) return badge;

  return (
    <Tooltip title={tooltip} arrow placement="top">
      {badge}
    </Tooltip>
  );
}
