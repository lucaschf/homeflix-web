import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useByGenre, useGenres, type CatalogTypeFilter } from "../api/hooks";
import type { Genre } from "../api/types";
import { genreNameSet, selectGenreRowItems } from "../utils/genreRows";
import { CarouselSkeleton } from "./CarouselSkeleton";
import { MediaCard } from "./MediaCard";
import { MediaCarousel } from "./MediaCarousel";

/**
 * Page size for one carousel's listing. Deliberately bigger than the
 * grid's default: the row only renders the titles whose *primary*
 * genre it is (see `utils/genreRows`), so a 20-item page would resolve
 * to a handful of cards and immediately need a second round-trip. At 40
 * a single request fills the row for every genre in a typical library.
 */
const CAROUSEL_PAGE_SIZE = 40;

/**
 * Cards a row aims for before it stops borrowing titles it merely
 * shares — roughly a desktop row's visible width. Genres that are
 * almost never a title's primary (Mistério: 71 titles in this library,
 * 7 of them primary) still read as a row instead of a stub.
 */
const MIN_ROW_SIZE = 8;

/**
 * Pages one carousel walks at most. A row is a teaser, not the genre —
 * past this the user goes to "See all", which lists the genre whole and
 * unfiltered. The cap also bounds the thin-row case: a row too short to
 * scroll keeps its right-edge sentinel permanently in view, which would
 * otherwise drain the entire listing on mount.
 */
const MAX_CAROUSEL_PAGES = 3;

interface GenreCarouselProps {
  genre: Genre;
  /**
   * Optional media-type filter forwarded to `useByGenre`. Passed
   * through from the Browse page's `?type=` URL param so the
   * Movies and Series tabs each see their own half of the catalog.
   */
  type?: CatalogTypeFilter;
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
 * The row shows the titles this genre is the *primary* genre of, not
 * everything tagged with it: a title averages 2.8 genres, so rendering
 * the raw listing repeated the same posters down the whole page. See
 * `utils/genreRows` for the rule, and for the top-up that keeps genres
 * nobody is primarily tagged with on the page. "See all" still opens
 * the genre whole — the grid at `/browse?genre=` does no such filtering.
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
export function GenreCarousel({ genre, type }: GenreCarouselProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, pageCount, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useByGenre(genre.id, { type, pageSize: CAROUSEL_PAGE_SIZE });

  // The same genres list the page laid its rows out from — React Query
  // serves it straight from cache, since the parent already fetched it
  // to know which carousels to mount. It tells the row which labels own
  // a row on this page, which is all the primary-genre rule needs.
  const { data: genres } = useGenres({ type });
  const knownGenreNames = useMemo(() => genreNameSet(genres), [genres]);

  // Whether this row still has listing left to walk, which gates both
  // the sentinel below and the top-up: borrowing before the walk is
  // done would show cards the next page then pushes back out of the
  // row, and a card vanishing under the pointer is worse than a row
  // that grows while it loads.
  const willLoadMore = hasNextPage && pageCount < MAX_CAROUSEL_PAGES;
  const rowItems = useMemo(
    () =>
      selectGenreRowItems(items, genre.name, knownGenreNames, willLoadMore ? 0 : MIN_ROW_SIZE),
    [items, genre.name, knownGenreNames, willLoadMore],
  );

  // The sentinel that pulls the next page lives inside MediaCarousel,
  // at the right edge of the scroll row — so a row with nothing to show
  // yet has nothing to trigger it, and would sit on its skeleton
  // forever. Drive that one case from here; the page cap bounds it.
  useEffect(() => {
    if (rowItems.length === 0 && willLoadMore && !isFetchingNextPage) void fetchNextPage();
  }, [rowItems.length, willLoadMore, isFetchingNextPage, fetchNextPage]);

  // Stable callback for the carousel's IntersectionObserver. Without
  // useCallback the parent re-render hands MediaCarousel a brand-new
  // arrow each time, which would force the observer to be torn down
  // and rebuilt every render and burn cycles for nothing.
  const handleLoadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  // Preserve the current `?type=` filter (if any) when jumping into
  // the genre-grid view, so the "See all" link from a Movies-tab
  // carousel keeps the user on the Movies tab. Built as a real URL so
  // the carousel can render it as an `<a href>` (keyboard + new-tab)
  // rather than an imperative onClick.
  const seeAllHref = useMemo(() => {
    const params = new URLSearchParams({ genre: genre.id });
    if (type) params.set("type", type);
    return `/browse?${params.toString()}`;
  }, [genre.id, type]);

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

  // Nothing to show yet: keep the skeleton up while the row is still
  // hunting for the titles it owns, and drop the row only once the walk
  // is over with nothing to render.
  if (rowItems.length === 0) {
    return willLoadMore ? <CarouselSkeleton title={genre.name} /> : null;
  }

  return (
    <MediaCarousel
      title={genre.name}
      seeAllHref={seeAllHref}
      seeAllAriaLabel={t("browse.seeAllAria", { genre: genre.name })}
      onLoadMore={handleLoadMore}
      hasMore={willLoadMore}
      loadingMore={isFetchingNextPage}
    >
      {rowItems.map((item) => (
        <MediaCard
          key={`${item.type}:${item.id}`}
          title={item.title}
          year={item.year}
          imageUrl={item.poster_path ?? undefined}
          synopsis={item.synopsis ?? undefined}
          resolution={item.resolution}
          hdr={item.hdr}
          variant="poster"
          mediaId={item.id}
          mediaType={item.type}
          onPlay={
            // Only movies play straight from the card. Series need an
            // episode, so they get no play button — the card opens the
            // series detail page instead.
            item.type === "movie" ? () => navigate(`/play/movie/${item.id}`) : undefined
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
  /**
   * Optional media-type filter forwarded to `GenreCarousel`. Passed
   * through from the Browse page's `?type=` URL param.
   */
  type?: CatalogTypeFilter;
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
export function LazyGenreCarousel({ genre, type }: LazyGenreCarouselProps) {
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
    return <GenreCarousel genre={genre} type={type} />;
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
