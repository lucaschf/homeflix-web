import { useEffect, useMemo, useRef } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useByGenre,
  useFeatured,
  useGenres,
  useRecentlyAddedMovies,
  useRecentlyAddedSeries,
  type CatalogTypeFilter,
} from "../api/hooks";
import { CarouselSkeleton } from "../components/CarouselSkeleton";
import { LazyGenreCarousel } from "../components/GenreCarousel";
import { HeroBanner, type HeroSlide } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDuration } from "../utils/duration";

/**
 * Narrow an unvalidated ``?type=`` URL param down to the
 * `CatalogTypeFilter` union. Unknown / absent values degrade to
 * `undefined` (no filter) so a tampered URL doesn't crash the page.
 */
function parseTypeFilter(raw: string | null): CatalogTypeFilter | undefined {
  return raw === "movie" || raw === "series" ? raw : undefined;
}

export function Browse() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const genreFilter = searchParams.get("genre");
  const typeFilter = parseTypeFilter(searchParams.get("type"));

  // Tab title reflects the active type filter; the Browse landing
  // (no filter) reads as "Browse".
  useDocumentTitle(
    typeFilter === "movie"
      ? t("nav.movies")
      : typeFilter === "series"
        ? t("nav.series")
        : t("nav.browse"),
  );

  // Carousel-mode data: list every genre and let each carousel pull
  // its own first page lazily as it scrolls into view. The `type`
  // filter narrows the list to the corresponding tab's half of the
  // catalog — the Movies tab never sees a series-only genre.
  const { data: genres, isLoading: genresLoading } = useGenres({ type: typeFilter });

  // Hero rotates through the same media-type the tab is showing —
  // the Movies tab shouldn't banner a series on top of its carousels.
  const { data: featured } = useFeatured(typeFilter ?? "all");

  const heroSlides: HeroSlide[] = useMemo(
    () =>
      (featured ?? []).map((f) => ({
        id: f.id,
        type: f.type,
        title: f.title,
        synopsis: f.synopsis,
        year: f.year,
        duration: f.duration_formatted ? formatDuration(f.duration_formatted) : undefined,
        genres: f.genres,
        backdropUrl: f.backdrop_path,
        logoUrl: f.logo_path,
        contentRating: f.content_rating,
        trailerUrl: f.trailer_url,
      })),
    [featured],
  );

  return (
    <Box>
      {/* HeroBanner only on the carousel-mode landing — the genre
          grid (``?genre=X``) skips the hero. The component itself
          renders an internal placeholder when ``slides`` is empty,
          so the carousels below stay anchored while the featured
          query is in flight. */}
      {!genreFilter && (
        <HeroBanner
          slides={heroSlides}
          onPlay={(slide) => {
            // "Assistir" starts playback for a movie; a series has no
            // single playable target, so it opens the series detail
            // (where the resume / first-episode button lives).
            if (slide.type === "movie") navigate(`/play/movie/${slide.id}`);
            else navigate(`/series/${slide.id}`);
          }}
          onDetails={(slide) => {
            // Clicking the title logo opens the detail page.
            if (slide.type === "movie") navigate(`/movie/${slide.id}`);
            else navigate(`/series/${slide.id}`);
          }}
        />
      )}

      <Box
        sx={{
          // Carousel-mode bleed under the hero (-10) is the same
          // regardless of whether ``slides`` actually resolved —
          // the placeholder reserves the same vertical space, so
          // the negative margin still lines up with the bottom of
          // the (possibly placeholder) hero.
          mt: genreFilter ? 4 : -10,
          position: "relative",
          zIndex: 1,
        }}
      >
        {genreFilter ? (
          <GenreGrid
            genreId={genreFilter}
            type={typeFilter}
            displayName={
              genres?.find((g) => g.id === genreFilter)?.name ?? genreFilter
            }
            onClearFilter={() => {
              searchParams.delete("genre");
              setSearchParams(searchParams);
            }}
          />
        ) : genresLoading ? (
          // Structural skeleton while the genres list is in flight —
          // matches the post-load layout (Recently Added on type
          // tabs + a couple of genre rows) so the page doesn't
          // shift when the data lands.
          <>
            {typeFilter && <CarouselSkeleton title={t("home.recentlyAdded")} />}
            <CarouselSkeleton />
            <CarouselSkeleton />
          </>
        ) : (genres?.length ?? 0) > 0 ? (
          <>
            {typeFilter && <RecentlyAddedSection type={typeFilter} />}
            {(genres ?? []).map((genre) => (
              <LazyGenreCarousel key={genre.id} genre={genre} type={typeFilter} />
            ))}
          </>
        ) : (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <Typography variant="body1" color="text.secondary">
              {t("browse.noResults")}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * "Recently added" carousel scoped to the active type tab.
 *
 * Only mounted when ``?type=movie`` or ``?type=series`` is set —
 * the unfiltered Browse view delegates the mixed version to the Home
 * page, so showing it here too would just duplicate the row.
 *
 * Uses the per-type hooks (``useRecentlyAddedMovies`` /
 * ``useRecentlyAddedSeries``) instead of the mixed catalog hook so
 * the response stays scoped to one media type without an extra
 * round-trip to filter client-side.
 */
function RecentlyAddedSection({ type }: { type: CatalogTypeFilter }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const moviesQuery = useRecentlyAddedMovies();
  const seriesQuery = useRecentlyAddedSeries();

  if (type === "movie") {
    if (moviesQuery.data === undefined) {
      return <CarouselSkeleton title={t("home.recentlyAdded")} />;
    }
    const movies = moviesQuery.data;
    if (movies.length === 0) return null;
    return (
      <MediaCarousel title={t("home.recentlyAdded")}>
        {movies.map((movie) => (
          <MediaCard
            key={movie.id}
            title={movie.title}
            imageUrl={movie.poster_path ?? undefined}
            year={movie.year}
            synopsis={movie.synopsis ?? undefined}
            mediaId={movie.id}
            mediaType="movie"
            onPlay={() => navigate(`/play/movie/${movie.id}`)}
            onClick={() => navigate(`/movie/${movie.id}`)}
          />
        ))}
      </MediaCarousel>
    );
  }

  if (seriesQuery.data === undefined) {
    return <CarouselSkeleton title={t("home.recentlyAdded")} />;
  }
  const seriesList = seriesQuery.data;
  if (seriesList.length === 0) return null;
  return (
    <MediaCarousel title={t("home.recentlyAdded")}>
      {seriesList.map((series) => (
        <MediaCard
          key={series.id}
          title={series.title}
          imageUrl={series.poster_path ?? undefined}
          year={series.start_year}
          synopsis={series.synopsis ?? undefined}
          mediaId={series.id}
          mediaType="series"
          onClick={() => navigate(`/series/${series.id}`)}
        />
      ))}
    </MediaCarousel>
  );
}

interface GenreGridProps {
  genreId: string;
  displayName: string;
  onClearFilter: () => void;
  /**
   * Optional media-type filter forwarded to `useByGenre`. Keeps the
   * grid scoped to the parent tab when the user opened it from a
   * Movies- or Series-tab carousel's "See all" link.
   */
  type?: CatalogTypeFilter;
}

/**
 * Flat poster grid for `/browse?genre=X`. Uses `useByGenre` directly
 * (no carousel wrapper) and triggers `fetchNextPage` whenever a
 * sentinel below the grid scrolls into the viewport — that's the
 * standard infinite-scroll pattern from the booru-tagger-front
 * reference, with a 400px rootMargin so the next page is in flight
 * by the time the user reaches the end of the visible rows.
 */
function GenreGrid({ genreId, displayName, onClearFilter, type }: GenreGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useByGenre(
    genreId,
    { type },
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "40vh",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: { xs: 3, md: 6 }, mb: 3 }}>
        <Typography variant="h2">{displayName}</Typography>
        <Typography
          variant="body2"
          onClick={onClearFilter}
          sx={{
            color: "primary.main",
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {t("browse.all")} &gt;
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(3, 1fr)",
            sm: "repeat(4, 1fr)",
            md: "repeat(5, 1fr)",
            lg: "repeat(6, 1fr)",
            xl: "repeat(7, 1fr)",
          },
          gap: { xs: 1, sm: 1.5, md: 2 },
          px: { xs: 2, md: 6 },
        }}
      >
        {items.map((item) => (
          <MediaCard
            key={`${item.type}:${item.id}`}
            title={item.title}
            year={item.year}
            imageUrl={item.poster_path ?? undefined}
            synopsis={item.synopsis ?? undefined}
            variant="poster"
            fullWidth
            mediaId={item.id}
            mediaType={item.type}
            onPlay={
              // Only movies play straight from the card; series open
              // their detail page (no play button shown).
              item.type === "movie" ? () => navigate(`/play/movie/${item.id}`) : undefined
            }
            onClick={() =>
              navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)
            }
          />
        ))}
      </Box>

      {/* Sentinel + loading-more spinner below the grid. The
          IntersectionObserver above watches it relative to the page
          viewport so vertical scroll near the bottom triggers the
          next page fetch. */}
      <Box
        ref={sentinelRef}
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 80,
          mt: 2,
        }}
      >
        {isFetchingNextPage && <CircularProgress color="primary" size={28} />}
      </Box>
    </>
  );
}
