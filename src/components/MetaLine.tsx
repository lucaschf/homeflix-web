import { Box, Typography } from "@mui/material";
import { inkAlpha, whiteAlpha } from "../theme/tokens";
import { ContentRatingBadge } from "./ContentRatingBadge";

interface MetaLineProps {
  contentRating: string | null;
  year: number | null;
  duration: string | null;
  genres: string[];
}

export function MetaLine({ contentRating, year, duration, genres }: MetaLineProps) {
  const primaryGenre = genres[0];
  const secondaryGenre = genres[1];
  const tokens: { key: string; node: React.ReactNode }[] = [];

  if (year) tokens.push({ key: "year", node: String(year) });
  if (duration) tokens.push({ key: "duration", node: duration });
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
