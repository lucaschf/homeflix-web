import { Box } from "@mui/material";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { neutral } from "../theme/colors";
import { scrim } from "../theme/tokens";

/**
 * Small "watched" check badge for a completed episode's thumbnail, so
 * finished episodes read at a glance in the season grid / list /
 * drawer. Absolutely positioned by the caller.
 */
export function WatchedBadge({ size = 20 }: { size?: number }) {
  const { t } = useTranslation();

  return (
    <Box
      role="img"
      aria-label={t("episode.watched")}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "primary.main",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 1px 4px ${scrim(0.5)}`,
      }}
    >
      <Check size={Math.round(size * 0.6)} color={neutral[950]} strokeWidth={3} />
    </Box>
  );
}
