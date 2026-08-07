import { Box, Typography } from "@mui/material";
import { inkAlpha, whiteAlpha } from "../theme/tokens";
import { ContentRatingBadge } from "./ContentRatingBadge";

interface MetaLineProps {
  contentRating: string | null;
  /**
   * Primary facts shown pipe-separated after the rating badge — e.g.
   * ``[year, duration]`` for a movie or ``[yearRange, seasonCount]``
   * for a series. Falsy entries are dropped so callers can pass
   * optional fields inline.
   */
  items: (string | number | null | undefined)[];
  genres: string[];
}

/**
 * The metadata strip under a detail-page title (rating badge, a few
 * pipe-separated facts, the lead genre inline and the next genre as a
 * hairline pill). Shared by ``MovieDetail`` and ``SeriesDetail`` so
 * both pages read with one visual language instead of each hand-rolling
 * its own separators and chips.
 */
export function MetaLine({ contentRating, items, genres }: MetaLineProps) {
  const primaryGenre = genres[0];
  const secondaryGenre = genres[1];
  const tokens: { key: string; node: React.ReactNode }[] = [];

  items
    .filter((item): item is string | number => item != null && item !== "")
    .forEach((item, idx) => tokens.push({ key: `item-${idx}`, node: String(item) }));
  if (primaryGenre) tokens.push({ key: "genre", node: primaryGenre });

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        mb: 1.5,
        flexWrap: "wrap",
        color: inkAlpha(0.78),
        fontSize: { xs: "0.8125rem", md: "0.875rem" },
      }}
    >
      {contentRating && <ContentRatingBadge rating={contentRating} size={24} />}
      {tokens.map((t, idx) => (
        <Box key={t.key} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
          {idx > 0 && (
            <Box component="span" sx={{ opacity: 0.4 }}>
              |
            </Box>
          )}
          <Typography component="span" variant="body2" sx={{ color: "inherit", fontSize: "inherit" }}>
            {t.node}
          </Typography>
        </Box>
      ))}
      {secondaryGenre && (
        <Box
          component="span"
          sx={{
            fontSize: "0.6875rem",
            padding: "2px 8px",
            border: `1px solid ${whiteAlpha(0.2)}`,
            borderRadius: "12px",
            color: "inherit",
            lineHeight: 1.4,
          }}
        >
          {secondaryGenre}
        </Box>
      )}
    </Box>
  );
}
