import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Typography,
} from "@mui/material";
import { ArrowDownUp, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SegmentedControl, type SegmentedOption } from "../components/admin/SegmentedControl";
import { border } from "../theme/tokens";
import {
  useByGenre,
  useContinueWatching,
  useFeatured,
  useGenres,
  useRecentlyAddedMovies,
  useRecentlyAddedSeries,
  type CatalogSort,
  type CatalogTypeFilter,
} from "../api/hooks";
import { CarouselSkeleton } from "../components/CarouselSkeleton";
import { LazyGenreCarousel } from "../components/GenreCarousel";
import { HeroBanner, type HeroSlide } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { CARD_WIDTH } from "../components/mediaCardDimensions";
import { MediaCarousel } from "../components/MediaCarousel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDuration } from "../utils/duration";
import { findResumeEpisode } from "../utils/resumeEpisode";

/**
 * Narrow an unvalidated ``?type=`` URL param down to the
 * `CatalogTypeFilter` union. Unknown / absent values degrade to
 * `undefined` (no filter) so a tampered URL doesn't crash the page.
 */
function parseTypeFilter(raw: string | null): CatalogTypeFilter | undefined {
  return raw === "movie" || raw === "series" ? raw : undefined;
}

const CATALOG_SORTS: CatalogSort[] = [
  "title_asc",
  "title_desc",
  "year_desc",
  "year_asc",
  "recently_added",
];

/** Narrow an unvalidated ``?sort=`` URL param down to the union. */
function parseSort(raw: string | null): CatalogSort | undefined {
  return CATALOG_SORTS.includes(raw as CatalogSort) ? (raw as CatalogSort) : undefined;
}

export function Browse() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const genreFilter = searchParams.get("genre");
  const typeFilter = parseTypeFilter(searchParams.get("type"));
  // Active sort order from the URL; unknown/absent degrades to
  // undefined so the grid falls back to the backend default (title_asc).
  const sortFilter = parseSort(searchParams.get("sort"));

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

  // Unscoped genres list — always carries every genre's localized name,
  // regardless of the active type filter. The type-scoped `genres`
  // above drops a genre entirely once the current type has zero items
  // in it, so the header reads its name from here (stable "Terror")
  // while the count still comes from the scoped entry. React Query
  // dedupes this against the same query the Home / landing view fires.
  const { data: allGenres } = useGenres();
  const resolvedGenre = genreFilter ? genres?.find((g) => g.id === genreFilter) : undefined;
  const genreDisplayName = genreFilter
    ? (allGenres?.find((g) => g.id === genreFilter)?.name ?? resolvedGenre?.name ?? genreFilter)
    : "";

  // Hero rotates through the same media-type the tab is showing —
  // the Movies tab shouldn't banner a series on top of its carousels.
  const { data: featured } = useFeatured(typeFilter ?? "all");

  // Powers "Continuar" on a series hero slide — resume the in-progress
  // episode straight from the hero instead of routing via the detail.
  const { data: continueWatching } = useContinueWatching();

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
            // "Assistir" starts playback for a movie. A series resumes
            // its in-progress episode when there is one; otherwise it
            // opens the detail page (which owns the first-episode /
            // season picker).
            if (slide.type === "movie") {
              navigate(`/play/movie/${slide.id}`);
              return;
            }
            const resume = findResumeEpisode(continueWatching, slide.id);
            if (resume) {
              navigate(`/play/episode/${slide.id}/${resume.season}/${resume.episode}`);
            } else {
              navigate(`/series/${slide.id}`);
            }
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
          // Carousel-mode bleed under the hero is the same regardless
          // of whether ``slides`` actually resolved — the placeholder
          // reserves the same vertical space, so the negative margin
          // still lines up with the bottom of the (possibly
          // placeholder) hero. On mobile the hero is now a contained
          // 4:5 card whose slide dots sit inside it near the bottom
          // edge, so there's no bleed to pull into — a positive gap
          // keeps the first carousel ("Adicionados Recentemente") clear
          // of the dots while desktop keeps its deep full-bleed overlap
          // (matches Home).
          mt: genreFilter ? 4 : { xs: 2, md: -10 },
          position: "relative",
          zIndex: 1,
        }}
      >
        {genreFilter ? (
          <GenreGrid
            genreId={genreFilter}
            type={typeFilter}
            displayName={genreDisplayName}
            count={resolvedGenre?.count}
            sort={sortFilter}
            onClearFilter={() => {
              searchParams.delete("genre");
              setSearchParams(searchParams);
            }}
            onTypeChange={(next) => {
              if (next === "all") searchParams.delete("type");
              else searchParams.set("type", next);
              setSearchParams(searchParams);
            }}
            onSortChange={(next) => {
              searchParams.set("sort", next);
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

// Shared poster-grid geometry. Columns are FIXED-WIDTH (not `1fr`) at
// exactly ``CARD_WIDTH.poster`` so the grid cards are the same size as
// the Home / carousel cards instead of stretching to fill the row —
// ``auto-fill`` just packs as many fixed columns as fit. Gap (12px) and
// horizontal padding match the carousels so the "See all" → grid
// transition is seamless. The skeleton reuses these so load is a clean
// content swap, not a reflow.
const GRID_COLUMNS = {
  xs: `repeat(auto-fill, ${CARD_WIDTH.poster.xs}px)`,
  sm: `repeat(auto-fill, ${CARD_WIDTH.poster.sm}px)`,
  md: `repeat(auto-fill, ${CARD_WIDTH.poster.md}px)`,
  lg: `repeat(auto-fill, ${CARD_WIDTH.poster.lg}px)`,
} as const;
const GRID_GAP = 1.5;
const GRID_PX = { xs: 3, md: 6 } as const;

interface GenreGridProps {
  genreId: string;
  displayName: string;
  /**
   * Total titles in this genre, scoped to `type` when a type filter is
   * active. Drives the "N titles" subtitle; omitted while the parent's
   * genres list is still loading.
   */
  count?: number;
  onClearFilter: () => void;
  /**
   * Optional media-type filter forwarded to `useByGenre`. Keeps the
   * grid scoped to the parent tab when the user opened it from a
   * Movies- or Series-tab carousel's "See all" link.
   */
  type?: CatalogTypeFilter;
  /**
   * Switch the active `?type=` filter from the in-grid segmented
   * control. `"all"` clears the filter; `"movie"` / `"series"` narrow
   * the listing server-side (the backend accepts the same `type` param
   * the carousels already use).
   */
  onTypeChange: (next: CatalogTypeFilter | "all") => void;
  /**
   * Active sort order forwarded to `useByGenre`. Undefined ⇒ the
   * server default (`title_asc`); see `docs/by-genre-sort-contract.md`.
   */
  sort?: CatalogSort;
  /** Switch the sort order from the in-grid dropdown (updates `?sort=`). */
  onSortChange: (next: CatalogSort) => void;
}

/**
 * Sort dropdown for the genre grid. Maps the five `CatalogSort` values
 * to their existing i18n labels.
 */
function GenreSortMenu({
  value,
  onChange,
}: {
  value: CatalogSort;
  onChange: (next: CatalogSort) => void;
}) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const options: { value: CatalogSort; label: string }[] = [
    { value: "title_asc", label: t("browse.titleAZ") },
    { value: "title_desc", label: t("browse.titleZA") },
    { value: "year_desc", label: t("browse.yearNewest") },
    { value: "year_asc", label: t("browse.yearOldest") },
    { value: "recently_added", label: t("browse.recentlyAdded") },
  ];
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ArrowDownUp size={16} />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          color: "text.secondary",
          borderColor: border.hairline,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&:hover": { borderColor: border.hairlineStrong },
        }}
      >
        {t("browse.sortBy")}: {current.label}
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {options.map((o) => (
          <MenuItem
            key={o.value}
            selected={o.value === value}
            onClick={() => {
              onChange(o.value);
              setAnchorEl(null);
            }}
          >
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * Structural skeleton for the genre grid's first load: a full grid of
 * poster-shaped placeholders on the exact same breakpoints as the real
 * grid, so the load resolves as a content swap instead of the old
 * centered-spinner → grid jump.
 */
function GenreGridSkeleton() {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: GRID_GAP, px: GRID_PX }}>
      {Array.from({ length: 18 }, (_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          animation="wave"
          sx={{ width: "100%", aspectRatio: "2/3", borderRadius: 2 }}
        />
      ))}
    </Box>
  );
}

/**
 * Flat poster grid for `/browse?genre=X`. Uses `useByGenre` directly
 * (no carousel wrapper) and triggers `fetchNextPage` whenever a
 * sentinel below the grid scrolls into the viewport — that's the
 * standard infinite-scroll pattern from the booru-tagger-front
 * reference, with a 400px rootMargin so the next page is in flight
 * by the time the user reaches the end of the visible rows.
 */
function GenreGrid({
  genreId,
  displayName,
  count,
  onClearFilter,
  type,
  onTypeChange,
  sort,
  onSortChange,
}: GenreGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useByGenre(genreId, { type, sort });

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

  // Result count for the subtitle: the parent's genre-scoped `count`
  // when available, else an explicit 0 once the query has resolved to
  // an empty list — the genre-has-no-items-of-this-type case, where the
  // parent's count is undefined because the genre isn't in the
  // type-scoped genres list at all.
  const resolvedCount =
    count ?? (!isLoading && !isError && items.length === 0 ? 0 : undefined);

  // Type filter reflected in the URL — switching a segment re-runs the
  // by-genre query under a new cache key (server-side narrowing), so
  // the grid falls back to its skeleton for a clean swap.
  const typeOptions: SegmentedOption<"all" | "movie" | "series">[] = [
    { value: "all", label: t("browse.all") },
    { value: "movie", label: t("nav.movies") },
    { value: "series", label: t("nav.series") },
  ];

  return (
    <>
      {/* Header: back affordance + genre name + result count on the
          left, the type filter on the right (stacks under the title on
          phones). Replaces the old bare "Todos >" text-clear. */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          gap: { xs: 1.5, md: 2 },
          px: { xs: 3, md: 6 },
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
          <IconButton
            onClick={onClearFilter}
            aria-label={t("browse.backToBrowse")}
            size="small"
            sx={{ color: "text.secondary", flexShrink: 0, "&:hover": { color: "text.primary" } }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h2" noWrap>
              {displayName}
            </Typography>
            {resolvedCount !== undefined && (
              <Typography variant="body2" color="text.secondary">
                {t("browse.titlesCount", { count: resolvedCount })}
              </Typography>
            )}
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          <GenreSortMenu value={sort ?? "title_asc"} onChange={onSortChange} />
          <SegmentedControl
            value={type ?? "all"}
            options={typeOptions}
            onChange={onTypeChange}
            ariaLabel={t("browse.filterType")}
          />
        </Box>
      </Box>

      {isLoading ? (
        <GenreGridSkeleton />
      ) : isError ? (
        <Box sx={{ textAlign: "center", py: 10, px: 3 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {t("common.errorLoadingSection")}
          </Typography>
          <Button variant="outlined" color="primary" onClick={() => void refetch()}>
            {t("common.retry")}
          </Button>
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 10, px: 3 }}>
          <Typography variant="body1" color="text.secondary">
            {t("browse.noResults")}
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              gap: GRID_GAP,
              px: GRID_PX,
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
      )}
    </>
  );
}
