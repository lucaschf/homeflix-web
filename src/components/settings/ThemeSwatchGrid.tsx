import { alpha } from "@mui/material/styles";
import { Box, ButtonBase, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  accentFor,
  isRetroPrint,
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
 *
 * The retro-print family sits in its own labelled group below the rest:
 * those schemes share one paper and differ only by ink, so side by side
 * they read as a set rather than as seven unrelated cards. Membership is
 * derived too (``isRetroPrint`` checks the shared paper), and the group's
 * cards are tinted with the family's cream so the paper is visible before
 * a theme is picked.
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

function SwatchCard({
  scheme,
  selected,
  onSelect,
}: {
  scheme: ThemeScheme;
  selected: boolean;
  onSelect: (scheme: ThemeScheme) => void;
}) {
  const { t } = useTranslation();
  const [a1, a2] = pipsFor(scheme);
  const [name, qualifier] = splitLabel(t(`settings.themes.${scheme}`));
  // Retro cards carry a wash of their paper cream (the family's secondary)
  // instead of the neutral white hairline, so the group reads as print.
  const paper = isRetroPrint(scheme) ? a2 : undefined;
  const restBg = paper ? alpha(paper, 0.05) : whiteAlpha(0.02);
  const restBorder = paper ? alpha(paper, 0.18) : whiteAlpha(0.08);
  const hoverBorder = paper ? alpha(paper, 0.34) : whiteAlpha(0.16);

  return (
    <ButtonBase
      onClick={() => onSelect(scheme)}
      aria-pressed={selected}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 0.875,
        p: 1.25,
        borderRadius: 1.25,
        textAlign: "left",
        bgcolor: selected ? whiteAlpha(0.06) : restBg,
        border: `1px solid ${selected ? a1 : restBorder}`,
        "&:hover": { borderColor: selected ? a1 : hoverBorder },
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
}

function SwatchGrid({
  schemes,
  value,
  onChange,
}: {
  schemes: readonly ThemeScheme[];
  value: ThemeScheme;
  onChange: (scheme: ThemeScheme) => void;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        // Four columns from ``sm`` up: the widest count that still leaves each
        // card room for the "name + qualifier" label pair without truncating.
        // The last row wraps short whenever the scheme count is not a multiple
        // of four — that is fine; don't re-tune the column count per theme
        // added, it only moves the ragged row around.
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(4, 1fr)",
        },
        gap: 1,
      }}
    >
      {schemes.map((scheme) => (
        <SwatchCard
          key={scheme}
          scheme={scheme}
          selected={scheme === value}
          onSelect={onChange}
        />
      ))}
    </Box>
  );
}

export function ThemeSwatchGrid({
  value,
  onChange,
}: {
  value: ThemeScheme;
  onChange: (scheme: ThemeScheme) => void;
}) {
  const { t } = useTranslation();
  const general = THEME_SCHEMES.filter((s) => !isRetroPrint(s));
  const retro = THEME_SCHEMES.filter(isRetroPrint);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <SwatchGrid schemes={general} value={value} onChange={onChange} />
      {retro.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <Typography
              component="div"
              sx={{
                fontSize: fontSize.badge,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "text.primary",
              }}
            >
              {t("settings.themeGroups.retro")}
            </Typography>
            <Typography
              component="div"
              sx={{ fontSize: fontSize.badge, color: "text.secondary" }}
            >
              {t("settings.themeGroups.retroHint")}
            </Typography>
          </Box>
          <SwatchGrid schemes={retro} value={value} onChange={onChange} />
        </Box>
      )}
    </Box>
  );
}
