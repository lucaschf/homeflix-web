import { Box, ButtonBase, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { peach } from "../../theme/colors";
import { whiteAlpha } from "../../theme/tokens";

/**
 * The four caption colors as swatches — the value *is* the color, so a
 * dropdown listing the word "Cyan" was strictly less informative than
 * showing it. Values are the stored preference verbatim (the player reads
 * them as CSS colors), so an existing profile keeps its pick.
 */
const COLORS: { value: string; labelKey: string }[] = [
  { value: "#FFFFFF", labelKey: "settings.colors.white" },
  { value: "#FFFF00", labelKey: "settings.colors.yellow" },
  { value: "#00FF00", labelKey: "settings.colors.green" },
  { value: "#00FFFF", labelKey: "settings.colors.cyan" },
];

export function SubtitleColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      {COLORS.map((color) => {
        const label = t(color.labelKey);
        const selected = value.toUpperCase() === color.value;
        return (
          <Tooltip key={color.value} title={label}>
            <ButtonBase
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onChange(color.value)}
              sx={{
                width: 30,
                height: 30,
                borderRadius: 1,
                bgcolor: color.value,
                border: `1px solid ${whiteAlpha(0.12)}`,
                // Ring with a gap, so the accent reads against the swatch
                // even when the swatch itself is white.
                outline: selected ? `2px solid ${peach.main}` : "none",
                outlineOffset: 2,
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
