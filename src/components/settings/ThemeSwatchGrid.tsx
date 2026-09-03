import { Box, ButtonBase, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  accentFor,
  neutralFor,
  secondaryAccentFor,
  THEME_SCHEMES,
  type ThemeScheme,
} from "../../theme/colors";
import { fontSize, whiteAlpha } from "../../theme/tokens";

/**
 * Theme picker as a grid of swatches instead of a ten-item dropdown:
 * every theme is visible at once and each one shows the two colors that
 * actually change — its accent, and either its optional secondary accent
 * or the page surface it paints (which is what separates OLED from
 * Midnight from Cinema).
 *
 * Both pips are derived from the palette tables, so adding a theme stays
 * "one entry in ``THEME_SCHEMES`` + its palette rows + a label" — this
 * grid needs no per-theme table of its own.
 */

const pipsFor = (scheme: ThemeScheme): [string, string] => [
  accentFor(scheme).main,
  secondaryAccentFor(scheme)?.main ?? neutralFor(scheme)[950],
];

/**
 * Split "HomeFlix (Coral)" into name + qualifier so the qualifier can sit
 * on its own line at a lighter weight. Labels without parentheses ("Teal",
 * "Violet") simply have no qualifier.
 */
function splitLabel(label: string): [string, string | undefined] {
  const match = /^(.*?)\s*\((.*)\)$/.exec(label);
  return match ? [match[1], match[2]] : [label, undefined];
}

export function ThemeSwatchGrid({
  value,
  onChange,
}: {
  value: ThemeScheme;
  onChange: (scheme: ThemeScheme) => void;
}) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "grid",
        // Four columns from ``sm`` up so the scheme count divides evenly and
        // the last row never leaves a lone orphan card.
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(4, 1fr)",
        },
        gap: 1,
      }}
    >
      {THEME_SCHEMES.map((scheme) => {
        const [a1, a2] = pipsFor(scheme);
        const [name, qualifier] = splitLabel(t(`settings.themes.${scheme}`));
        const selected = scheme === value;
        return (
          <ButtonBase
            key={scheme}
            onClick={() => onChange(scheme)}
            aria-pressed={selected}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 0.875,
              p: 1.25,
              borderRadius: 1.25,
              textAlign: "left",
              bgcolor: selected ? whiteAlpha(0.06) : whiteAlpha(0.02),
              border: `1px solid ${selected ? a1 : whiteAlpha(0.08)}`,
              "&:hover": { borderColor: selected ? a1 : whiteAlpha(0.16) },
            }}
          >
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {[a1, a2].map((color, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 13,
                    height: 13,
                    borderRadius: "50%",
                    bgcolor: color,
                    boxShadow: `inset 0 0 0 1px ${whiteAlpha(0.12)}`,
                  }}
                />
              ))}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="div"
                sx={{
                  fontSize: fontSize.control,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: selected ? "text.primary" : "text.secondary",
                }}
              >
                {name}
              </Typography>
              {qualifier && (
                <Typography
                  component="div"
                  sx={{
                    fontSize: fontSize.badge,
                    fontWeight: 500,
                    lineHeight: 1.3,
                    color: "text.secondary",
                  }}
                >
                  {qualifier}
                </Typography>
              )}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
