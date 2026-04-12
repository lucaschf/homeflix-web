import { Box, Skeleton, Typography } from "@mui/material";

interface CarouselSkeletonProps {
  /**
   * Optional real title shown above the skeleton row. When the
   * caller already knows the title (e.g. `LazyGenreCarousel` got
   * the genre name from `useGenres()` before mounting the per-genre
   * query), it's rendered as actual `<Typography>` text so the
   * user immediately sees which carousel is loading. Without a
   * title, a placeholder skeleton line is rendered instead so the
   * vertical space stays the same.
   */
  title?: string;
  /**
   * Number of fake card slots to render. Defaults to 6 — enough
   * to fill ~2 viewport widths on a wide desktop while still
   * looking believable on a phone.
   */
  cardCount?: number;
}

/**
 * Loading placeholder for a media carousel.
 *
 * Mimics the real `MediaCarousel` layout so the transition into
 * the loaded state is a content swap rather than a layout change:
 * same outer margin, same horizontal padding, same gap, same card
 * aspect ratio, same width breakpoints. The placeholder also
 * reserves enough vertical space for the row + a header line so
 * the page never reflows when the real component takes over.
 *
 * Used by:
 * - `LazyGenreCarousel` as the unmounted placeholder before the
 *   inner `GenreCarousel` enters the viewport.
 * - `GenreCarousel` itself as the loading state of `useByGenre`'s
 *   first page.
 */
export function CarouselSkeleton({ title, cardCount = 6 }: CarouselSkeletonProps) {
  return (
    <Box sx={{ mb: 4 }}>
      {/* Header — either a real title (when known) or a skeleton
          line. Matches the real header's `variant`, `mb` and
          horizontal padding so the title position is identical
          before and after load. */}
      <Box sx={{ px: { xs: 3, md: 6 }, mb: 1.5 }}>
        {title ? (
          // Render the actual title immediately so the user knows
          // which carousel is loading. Uses the same `variant="h2"`
          // and `noWrap` as `MediaCarousel`'s real header for a
          // pixel-perfect handoff.
          <Typography variant="h2" noWrap>
            {title}
          </Typography>
        ) : (
          <Skeleton variant="text" width={180} height={32} />
        )}
      </Box>

      {/* Row of card-shaped skeletons matching MediaCard's poster
          dimensions exactly: 2/3 aspect ratio + responsive width
          breakpoints. The wave animation makes it feel "alive"
          instead of frozen.

          Wrapped in a Box that owns the responsive width and the
          aspect ratio so the inner Skeleton can fill it 100%/100%.
          MUI Skeleton has its own internal `height` default that
          ignores `aspectRatio` from `sx` — passing the dimensions
          on a wrapper Box and letting the Skeleton be a 100% / 100%
          child is the canonical pattern, otherwise the row collapses
          to a sliver of skeletons a few pixels tall. */}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "hidden",
          px: { xs: 3, md: 6 },
        }}
      >
        {Array.from({ length: cardCount }, (_, index) => (
          <Box
            key={index}
            sx={{
              flexShrink: 0,
              width: { xs: 140, sm: 200, md: 240, lg: 280 },
              aspectRatio: "2/3",
            }}
          >
            <Skeleton
              variant="rounded"
              animation="wave"
              sx={{ width: "100%", height: "100%", borderRadius: 2 }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
