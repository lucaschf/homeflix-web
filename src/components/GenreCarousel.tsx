import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useByGenre } from "../api/hooks";
import type { Genre } from "../api/types";
import { CarouselSkeleton } from "./CarouselSkeleton";
import { MediaCard } from "./MediaCard";
import { MediaCarousel } from "./MediaCarousel";

interface GenreCarouselProps {
  genre: Genre;
}

/**
 * One genre carousel that owns its own paginated query.
 *
 * Wraps the presentational `MediaCarousel` with the `useByGenre`
 * infinite hook and a "fetch when the right edge is near" loop. The
 * carousel forwards `fetchNextPage` to the underlying scroll-row
 * sentinel — see `MediaCarousel`'s `onLoadMore` prop for how the
 * IntersectionObserver is wired against the inner scroll container.
 *
 * Render states:
 * - Initial load: `<CarouselSkeleton title=... />` mimicking the
 *   final layout, so the transition is a content swap rather than a
 *   layout change.
 * - Error: a single dimmed line below the title so the user knows
 *   something failed instead of staring at a silently-disappearing
 *   carousel.
 * - Empty (after a successful load): returns `null`. The page-level
 *   `LazyGenreCarousel` already pre-filters genres with `count > 0`
 *   from `useGenres`, so reaching this branch means the genre had
 *   items but they were soft-deleted between the genres call and
 *   the by-genre call — rare and acceptable.
 */
export function GenreCarousel({ genre }: GenreCarouselProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useByGenre(genre.id);

  // Stable callback for the carousel's IntersectionObserver. Without
  // useCallback the parent re-render hands MediaCarousel a brand-new
  // arrow each time, which would force the observer to be torn down
  // and rebuilt every render and burn cycles for nothing.
  const handleLoadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const handleSeeAll = useCallback(() => {
    navigate(`/browse?genre=${encodeURIComponent(genre.id)}`);
  }, [navigate, genre.id]);

  if (isLoading) {
    return <CarouselSkeleton title={genre.name} />;
  }

  if (isError) {
    return (
      <Box sx={{ mb: 4, px: { xs: 3, md: 6 } }}>
        <Typography variant="h2" gutterBottom>
          {genre.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("common.errorLoadingSection")}
        </Typography>
      </Box>
    );
  }

  if (items.length === 0) return null;

  return (
    <MediaCarousel
      title={genre.name}
      onSeeAll={handleSeeAll}
      onLoadMore={handleLoadMore}
      hasMore={hasNextPage}
      loadingMore={isFetchingNextPage}
    >
      {items.map((item) => (
        <MediaCard
          key={`${item.type}:${item.id}`}
          title={item.title}
          year={item.year}
          imageUrl={item.poster_path ?? undefined}
          synopsis={item.synopsis ?? undefined}
          variant="poster"
          mediaId={item.id}
          mediaType={item.type}
          onPlay={() =>
            navigate(item.type === "movie" ? `/play/movie/${item.id}` : `/series/${item.id}`)
          }
          onClick={() =>
            navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)
          }
        />
      ))}
    </MediaCarousel>
  );
}

interface LazyGenreCarouselProps {
  genre: Genre;
}

/**
 * Vertical lazy-mount wrapper around `GenreCarousel`.
 *
 * Renders a `CarouselSkeleton` (with the genre title baked in) as
 * the placeholder, so the page is anchored — the user knows which
 * carousel is loading even before its data is in flight. When the
 * placeholder enters the viewport (with a 600px buffer), the inner
 * `GenreCarousel` mounts and triggers its first network request.
 *
 * Genres with `count === 0` are skipped entirely — there's no
 * point reserving vertical space for a carousel that will resolve
 * to nothing. The Home and Browse pages can still pass the full
 * genres list and let this component filter.
 */
export function LazyGenreCarousel({ genre }: LazyGenreCarouselProps) {
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setIsVisible(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  // Suppress empty genres at the lazy level so they don't even
  // mount. The count comes from the cheap `/catalog/genres`
  // response, so we know up-front which carousels would resolve
  // to nothing — no need to reserve vertical space for them.
  // `!genre.count` covers both 0 and any defensive undefined
  // from an older API response that predates the count field.
  if (!genre.count) return null;

  if (isVisible) {
    return <GenreCarousel genre={genre} />;
  }

  // Placeholder skeleton matches the real layout's dimensions so
  // the post-mount transition is a content swap, not a reflow.
  // The genre title is rendered immediately (we already have it
  // from `useGenres`) so the page is anchored before any per-genre
  // request fires.
  return (
    <Box ref={placeholderRef}>
      <CarouselSkeleton title={genre.name} />
    </Box>
  );
}
