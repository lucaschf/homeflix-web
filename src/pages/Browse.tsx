import { useEffect, useMemo, useRef } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useByGenre, useFeatured, useGenres, type CatalogTypeFilter } from "../api/hooks";
import { LazyGenreCarousel } from "../components/GenreCarousel";
import { HeroBanner, type HeroSlide } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";

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
        duration: f.duration_formatted ?? undefined,
        genres: f.genres,
        backdropUrl: f.backdrop_path,
        logoUrl: f.logo_path,
        contentRating: f.content_rating,
        trailerUrl: f.trailer_url,
      })),
    [featured],
  );

  // Loading gate: only the carousel mode waits on the genres list.
  // The flat-grid mode below has its own loading state via the
  // useByGenre hook.
  if (!genreFilter && genresLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {!genreFilter && heroSlides.length > 0 && (
        <HeroBanner
          slides={heroSlides}
          onPlay={(slide) => {
            if (slide.type === "movie") navigate(`/movie/${slide.id}`);
            else navigate(`/series/${slide.id}`);
          }}
        />
      )}

      <Box
        sx={{
          mt: Boolean(genreFilter) || heroSlides.length === 0 ? 4 : -10,
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
        ) : (genres?.length ?? 0) > 0 ? (
          (genres ?? []).map((genre) => (
            <LazyGenreCarousel key={genre.id} genre={genre} type={typeFilter} />
          ))
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
            onPlay={() =>
              navigate(item.type === "movie" ? `/play/movie/${item.id}` : `/series/${item.id}`)
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
