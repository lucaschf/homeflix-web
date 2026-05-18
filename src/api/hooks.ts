import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "./client";
import type {
  AddItemToCustomListResponse,
  AdminUserDetail,
  AdminUserDetailResponse,
  AdminUserSummary,
  AdminUserSummaryResponse,
  AdminUsersResponse,
  ApiDetailResponse,
  BulkEnrichResponse,
  CatalogByGenreResponse,
  CatalogItem,
  CatalogRequest,
  CatalogRequestResponse,
  CatalogRequestsResponse,
  CollectionDetail,
  CollectionDetailResponse,
  ContinueWatchingItem,
  ContinueWatchingResponse,
  CreateAdminUserPayload,
  CustomListDetailResponse,
  CustomListItemOutput,
  CustomListItemsResponse,
  CustomListOutput,
  CustomListsResponse,
  EnrichResponse,
  FeaturedItem,
  FeaturedResponse,
  Genre,
  GenresResponse,
  HealthResponse,
  HlsCacheStats,
  HlsCacheStatsResponse,
  IntroMarkerOutput,
  LibrariesResponse,
  Library,
  LibraryResponse,
  LibrarySettings,
  ListMoviesResponse,
  ListSeriesResponse,
  PlaybackPreferencesData,
  PreferencesResponse,
  MovieDetail,
  MovieDetailResponse,
  MovieSummary,
  MoviesByActorResponse,
  NeedsReviewMovie,
  NeedsReviewMoviesResponse,
  PersonBio,
  PersonBioResponse,
  PromoteMovieToSeriesInput,
  PromoteMovieToSeriesPayload,
  PromoteMovieToSeriesResponse,
  ReadinessResponse,
  RecentlyAddedCatalogResponse,
  RecentlyAddedMoviesResponse,
  RecentlyAddedSeriesResponse,
  RelatedMoviesResponse,
  RelatedSeriesResponse,
  RelinkMovieInput,
  RelinkMoviePayload,
  RelinkMovieResponse,
  ProgressOutput,
  ProgressResponse,
  ScanResponse,
  SearchResponse,
  SeriesDetail,
  SeriesDetailResponse,
  SeriesSummary,
  TmdbSuggestionsPayload,
  TmdbSuggestionsResponse,
  ToggleWatchlistResponse,
  UpdateUserRolePayload,
  WatchlistItemOutput,
  WatchlistResponse,
} from "./types";

// ── Queries ──────────────────────────────────────────────

// ── Catalog (per-genre) ─────────────────────────────────

// Page size for the by-genre infinite query. Independent of the
// backend default — frontend always passes this explicitly. Picked
// to fill ~2-3 viewport widths of a horizontal carousel on a wide
// desktop, with enough buffer that the user rarely sees a loading
// spinner mid-scroll.
const BY_GENRE_PAGE_SIZE = 20;

/**
 * Narrow alias for the ``?type=`` query param. Shared by the catalog
 * hooks and the Browse page so a typo in one place breaks the
 * type-check instead of silently diverging.
 */
export type CatalogTypeFilter = "movie" | "series";

interface CatalogQueryOptions {
  /**
   * Optional ``?type=`` filter forwarded to the backend. When set,
   * the genres response only aggregates counts for that media type
   * and the by-genre response only pulls from the matching stream,
   * so the Movies and Series tabs can show a narrowed catalog.
   */
  type?: CatalogTypeFilter;
}

/**
 * Single fetch of every genre present in the library, with counts
 * and localized display names. The Home and Browse pages use the
 * result to lay out one carousel per genre and to know which genres
 * exist before mounting any per-genre infinite query.
 *
 * ``options.type`` narrows the result to a single media type — the
 * Movies and Series tabs pass ``"movie"`` / ``"series"`` so their
 * carousel layout excludes genres that only exist on the other
 * side of the catalog.
 */
export function useGenres(options: CatalogQueryOptions = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const { type } = options;
  return useQuery({
    // `type` is part of the key so the Movies and Series tabs get
    // independent caches — switching tabs doesn't hand one tab the
    // other tab's genre counts for a frame until the request lands.
    queryKey: ["catalog", "genres", lang, type ?? null],
    queryFn: async (): Promise<Genre[]> => {
      const params: Record<string, string> = { lang };
      if (type) params.type = type;
      const resp = await api.get<GenresResponse>("/catalog/genres", params);
      return resp.data;
    },
  });
}

/**
 * Cursor-paginated infinite query for one specific genre's items
 * (movies + series merged alphabetically by title). Unlike
 * `useMovies` / `useSeries`, this does NOT eagerly walk every
 * page on mount — the consumer drives pagination by calling
 * `fetchNextPage` from a horizontal-scroll IntersectionObserver,
 * one carousel at a time.
 *
 * The hook is disabled when `genreId` is empty so consumers can
 * defer mounting it until the parent has resolved which genre to
 * render.
 *
 * ``options.type`` restricts the merged stream to one side — the
 * Movies and Series tabs pass the filter through so a single-type
 * carousel never mixes in the other media type.
 */
export function useByGenre(genreId: string, options: CatalogQueryOptions = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const { type } = options;
  const query = useInfiniteQuery({
    // `type` is in the key so filtered and unfiltered listings keep
    // independent caches — otherwise a Movies-tab request would
    // serve its trimmed page to an All-tab consumer and vice versa.
    queryKey: ["catalog", "by-genre", genreId, lang, type ?? null],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = {
        lang,
        limit: String(BY_GENRE_PAGE_SIZE),
      };
      if (pageParam) params.cursor = pageParam;
      if (type) params.type = type;
      return api.get<CatalogByGenreResponse>(
        `/catalog/by-genre/${encodeURIComponent(genreId)}`,
        params,
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
    enabled: !!genreId,
  });

  const items = useMemo<CatalogItem[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
  };
}

// ── Catalog (per-actor) ─────────────────────────────────

// Page size for the per-actor infinite query. Same heuristic as
// ``BY_GENRE_PAGE_SIZE`` — fills a couple viewport widths of a
// vertical grid so the user rarely sees a loading spinner mid-scroll.
const BY_ACTOR_PAGE_SIZE = 24;

/**
 * Cursor-paginated infinite query for movies whose cast contains
 * the given actor. The Actor page mounts this hook with the name
 * URL-decoded from the route param and renders a vertical grid of
 * the resulting movies.
 *
 * The hook is disabled when ``actorName`` is empty so it doesn't
 * fire while the route resolver is still loading the param.
 */
export function useMoviesByActor(actorName: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useInfiniteQuery({
    queryKey: ["catalog", "by-actor", actorName, lang],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = {
        name: actorName,
        lang,
        limit: String(BY_ACTOR_PAGE_SIZE),
      };
      if (pageParam) params.cursor = pageParam;
      return api.get<MoviesByActorResponse>("/catalog/by-actor", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
    enabled: !!actorName,
  });

  const movies = useMemo<MovieSummary[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  return {
    movies,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
  };
}

// ── People (cast bio) ───────────────────────────────────

/**
 * Fetch biographical metadata for a TMDB person.
 *
 * Used by the actor page to render bio + birth date + known
 * department alongside the catalog filmography. The hook is
 * disabled when ``tmdbId`` is ``null`` so the page doesn't fire a
 * request for actors whose ``tmdb_id`` wasn't captured during
 * enrichment — those degrade to a name-only header instead.
 *
 * 404 / network errors collapse to ``null`` at the API layer; the
 * caller keeps rendering and just hides the bio block.
 */
export function usePerson(tmdbId: number | null) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    // ``lang`` is part of the cache key so switching the UI
    // language doesn't serve a stale cached bio in the wrong
    // language until the next stale-time tick.
    queryKey: ["person", tmdbId, lang],
    queryFn: async (): Promise<PersonBio | null> => {
      if (tmdbId == null) return null;
      try {
        const resp = await api.get<PersonBioResponse>(`/people/${tmdbId}`, { lang });
        return resp.data;
      } catch {
        // Treat 404 / network failure as "no bio available" so the
        // actor page renders the catalog-only header instead of an
        // error state. Bio is best-effort polish, never load-bearing.
        return null;
      }
    },
    enabled: tmdbId != null,
    // Bios change rarely; keep the cache warm so navigating back to
    // the same actor doesn't re-fetch.
    staleTime: 1000 * 60 * 60,
  });
}

// ── Search ──────────────────────────────────────────────

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Server-side full-text search with debounced queries.
 *
 * Calls `GET /api/v1/search?q=...` after the user stops typing for
 * 300ms. Returns the ranked result list directly — no eager-load,
 * no client-side filter, no full-catalog download.
 *
 * The query is disabled when `query` is empty so the overlay
 * starts in the "recent searches" state without a wasted request.
 */
export function useSearch(query: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  // Debounce: only fire the request once the user pauses typing.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const result = useQuery({
    queryKey: ["search", trimmed, lang],
    queryFn: async () => {
      const resp = await api.get<SearchResponse>("/search", {
        q: trimmed,
        lang,
        limit: "30",
      });
      return { items: resp.data, total: resp.metadata.total };
    },
    enabled: trimmed.length >= 1,
  });

  return {
    data: result.data?.items ?? [],
    total: result.data?.total ?? 0,
    isLoading: trimmed.length >= 1 && result.isLoading,
    isError: result.isError,
  };
}

export function useMovie(movieId: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["movie", movieId, lang],
    queryFn: async (): Promise<MovieDetail> => {
      const resp = await api.get<MovieDetailResponse>(`/movies/${movieId}`, { lang });
      return resp.data;
    },
    enabled: !!movieId,
  });
}

/**
 * Fetch the "you might also like" list for a movie — TMDB
 * recommendations filtered to titles that exist in the local
 * catalog, ordered by TMDB's relevance score.
 *
 * Best-effort: empty list when the movie has no ``tmdb_id``,
 * the provider returns nothing, or no recommendation overlaps
 * with the catalog. The carousel just doesn't render.
 */
export function useRelatedMovies(movieId: string | undefined, limit = 12) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["related-movies", movieId, lang, limit],
    queryFn: async (): Promise<MovieSummary[]> => {
      // ``enabled`` below guarantees ``movieId`` is set when the
      // fetcher runs — the non-null assertion lets us drop the
      // empty-string sentinel from call sites.
      const resp = await api.get<RelatedMoviesResponse>(`/movies/${movieId!}/related`, {
        lang,
        limit: String(limit),
      });
      return resp.data;
    },
    enabled: !!movieId,
  });
}

/**
 * Fetch the "you might also like" list for a series — TMDB
 * recommendations filtered to titles that exist in the local
 * catalog, ordered by TMDB's relevance score.
 *
 * Same best-effort contract as ``useRelatedMovies``: empty list
 * when the series has no ``tmdb_id``, the provider returns nothing,
 * or no recommendation overlaps with the catalog. The carousel
 * just doesn't render.
 */
export function useRelatedSeries(seriesId: string | undefined, limit = 12) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["related-series", seriesId, lang, limit],
    queryFn: async (): Promise<SeriesSummary[]> => {
      // ``enabled`` below guarantees ``seriesId`` is set when the
      // fetcher runs — the non-null assertion lets us drop the
      // empty-string sentinel from call sites.
      const resp = await api.get<RelatedSeriesResponse>(`/series/${seriesId!}/related`, {
        lang,
        limit: String(limit),
      });
      return resp.data;
    },
    enabled: !!seriesId,
  });
}

/**
 * Mixed top-N most recently added titles (movies + series) for the
 * Home page carousel.
 *
 * Backed by ``GET /api/v1/catalog/recently-added``. The backend
 * fetches the top ``limit`` newest from each repo, merges them by
 * ``created_at`` desc, and returns the top ``limit`` of the merged
 * list. The frontend renders a single carousel — type-specific
 * variants live on the Browse page (``useRecentlyAddedMovies`` /
 * ``useRecentlyAddedSeries``).
 */
export function useRecentlyAddedCatalog(limit = 20) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["catalog", "recently-added", lang, limit],
    queryFn: async (): Promise<CatalogItem[]> => {
      const resp = await api.get<RecentlyAddedCatalogResponse>("/catalog/recently-added", {
        lang,
        limit: String(limit),
      });
      return resp.data;
    },
  });
}

/**
 * Top-N most recently added movies for the home-page carousel.
 *
 * Backed by ``GET /api/v1/movies/recently-added`` — a bounded
 * projection ordered by ``id DESC`` (insertion order). No cursor or
 * pagination metadata; the carousel renders the full slice and the
 * Movies tab is the path to keep browsing.
 */
export function useRecentlyAddedMovies(limit = 20) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["movies", "recently-added", lang, limit],
    queryFn: async (): Promise<MovieSummary[]> => {
      const resp = await api.get<RecentlyAddedMoviesResponse>("/movies/recently-added", {
        lang,
        limit: String(limit),
      });
      return resp.data;
    },
  });
}

/**
 * Top-N most recently added series for the home-page carousel.
 *
 * Mirror of ``useRecentlyAddedMovies`` for the series side. Backed
 * by ``GET /api/v1/series/recently-added``.
 */
export function useRecentlyAddedSeries(limit = 20) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["series", "recently-added", lang, limit],
    queryFn: async (): Promise<SeriesSummary[]> => {
      const resp = await api.get<RecentlyAddedSeriesResponse>("/series/recently-added", {
        lang,
        limit: String(limit),
      });
      return resp.data;
    },
  });
}

/**
 * Cursor-paginated infinite query over the full series catalog.
 *
 * Powers the admin intro-editor picker, which needs a flat list of
 * every series in the library so the user can search and pick one
 * without going through the genre-organized browse pages.
 */
export function useListAllSeries() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useInfiniteQuery({
    queryKey: ["series", "all", lang],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = { lang, limit: "100" };
      if (pageParam) params.cursor = pageParam;
      return api.get<ListSeriesResponse>("/series", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  const items = useMemo<SeriesSummary[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
  };
}

export function useSeriesDetail(seriesId: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["series", seriesId, lang],
    queryFn: async (): Promise<SeriesDetail> => {
      const resp = await api.get<SeriesDetailResponse>(`/series/${seriesId}`, { lang });
      return resp.data;
    },
    enabled: !!seriesId,
  });
}

// ── Intro markers (admin) ───────────────────────────────

interface SetEpisodeIntroVars {
  /** External episode id (epi_xxx) — target of the PUT. */
  episodeId: string;
  /** Series id used to invalidate the cached series detail on success. */
  seriesId: string;
  start_seconds: number;
  end_seconds: number;
}

/**
 * Persist a manual intro marker on an episode. Backend always
 * stamps ``source = MANUAL`` regardless of any prior auto-detected
 * value, so editing an auto marker effectively converts it.
 */
export function useSetEpisodeIntro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId, start_seconds, end_seconds }: SetEpisodeIntroVars) =>
      api.put<ApiDetailResponse<IntroMarkerOutput>>(`/series/episodes/${episodeId}/intro`, {
        start_seconds,
        end_seconds,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["series", vars.seriesId] });
    },
  });
}

interface ClearEpisodeIntroVars {
  episodeId: string;
  seriesId: string;
}

/**
 * Remove the intro marker from an episode. Idempotent — clearing an
 * unmarked episode still resolves successfully and the episode
 * rejoins the auto-detection queue on the next job tick.
 */
export function useClearEpisodeIntro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId }: ClearEpisodeIntroVars) =>
      api.del(`/series/episodes/${episodeId}/intro`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["series", vars.seriesId] });
    },
  });
}

interface BulkSetIntroVars {
  /** Episode ids that should receive the same marker. */
  episodeIds: string[];
  seriesId: string;
  start_seconds: number;
  end_seconds: number;
}

interface BulkSetIntroResult {
  succeeded: number;
  failed: number;
}

/**
 * Apply the same intro marker to every episode in ``episodeIds`` by
 * firing one ``PUT /series/episodes/:id/intro`` per target in
 * parallel. There is no backend bulk endpoint — the use case
 * validates each marker against its own episode's duration, so
 * fanning out lets a partial set succeed even when one episode
 * rejects (e.g. its duration is shorter than ``end_seconds``).
 *
 * The cache is invalidated once after all calls settle so the
 * picker re-renders with the new badges in a single pass instead of
 * thrashing through N intermediate states.
 */
export function useBulkSetEpisodeIntros() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      episodeIds,
      start_seconds,
      end_seconds,
    }: BulkSetIntroVars): Promise<BulkSetIntroResult> => {
      const settled = await Promise.allSettled(
        episodeIds.map((id) =>
          api.put<ApiDetailResponse<IntroMarkerOutput>>(`/series/episodes/${id}/intro`, {
            start_seconds,
            end_seconds,
          }),
        ),
      );
      return {
        succeeded: settled.filter((r) => r.status === "fulfilled").length,
        failed: settled.filter((r) => r.status === "rejected").length,
      };
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ["series", vars.seriesId] });
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      try {
        const res = await fetch("/health");
        return res.ok ? ((await res.json()) as HealthResponse) : null;
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
  });
}

/**
 * Polls ``/health/ready`` every 30 s to drive the System health
 * card on the admin Overview (and the future ``/admin/system/health``
 * page). Mirrors ``useHealth`` — direct ``fetch`` because the
 * endpoint is mounted at root, no ``/api/v1`` prefix.
 */
export function useReadiness() {
  return useQuery({
    queryKey: ["readiness"],
    queryFn: async () => {
      try {
        const res = await fetch("/health/ready");
        return res.ok ? ((await res.json()) as ReadinessResponse) : null;
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
  });
}

export function useFeatured(mediaType: "all" | "movie" | "series" = "all", limit = 6) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["featured", mediaType, limit, lang],
    queryFn: async (): Promise<FeaturedItem[]> => {
      const resp = await api.get<FeaturedResponse>("/featured", {
        type: mediaType,
        limit: String(limit),
        lang,
      });
      return resp.data;
    },
  });
}

// ── Mutations ────────────────────────────────────────────

/**
 * Trigger a scan of one library. Backend ``POST /api/v1/scan`` (since
 * #175) requires a ``library_id`` in the body and resolves the
 * configured paths server-side, so the catalog row's owning library
 * lands on every Movie / Series the scanner registers. The "scan
 * all" flow now loops per-library on the call site rather than
 * flattening paths across libraries — the scanner is no longer a
 * pure path operation.
 */
export function useScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (libraryId: string) =>
      api.post<ScanResponse>("/scan", { library_id: libraryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
  });
}

export function useEnrichMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ movieId, force = false }: { movieId: string; force?: boolean }) =>
      api.post<EnrichResponse>(`/movies/${movieId}/enrich`, { force }),
    onSuccess: (_, { movieId }) => {
      queryClient.invalidateQueries({ queryKey: ["movie", movieId] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
    },
  });
}

export function useEnrichSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, force = false }: { seriesId: string; force?: boolean }) =>
      api.post<EnrichResponse>(`/series/${seriesId}/enrich`, { force }),
    onSuccess: (_, { seriesId }) => {
      queryClient.invalidateQueries({ queryKey: ["series", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
  });
}

export function useBulkEnrich() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (force: boolean) => api.post<BulkEnrichResponse>("/enrich", { force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
  });
}

// ── Watch Progress ──────────────────────────────────────

export function useProgress(mediaId: string) {
  return useQuery({
    queryKey: ["progress", mediaId],
    queryFn: async (): Promise<ProgressOutput | null> => {
      const resp = await api.get<ProgressResponse>(`/progress/${mediaId}`);
      return resp.data;
    },
    enabled: !!mediaId,
  });
}

export function useContinueWatching() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["continueWatching", lang],
    queryFn: async (): Promise<ContinueWatchingItem[]> => {
      const resp = await api.get<ContinueWatchingResponse>("/progress/continue-watching", { lang });
      return resp.data;
    },
  });
}

export function useClearProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string) => api.del(`/progress/${mediaId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "continueWatching",
      });
    },
  });
}

/**
 * Bulk-delete all episode progress for a series so dismiss from
 * "Continue Watching" actually removes the series instead of just
 * surfacing the next in-progress episode.
 */
export function useClearSeriesProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seriesId: string) => api.del(`/progress/series/${seriesId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "continueWatching",
      });
    },
  });
}

export function useSaveProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      media_id: string;
      media_type: string;
      position_seconds: number;
      duration_seconds: number;
      audio_track?: number;
      subtitle_track?: number;
    }) => api.put<ProgressResponse>("/progress", data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["progress", vars.media_id] });
      // Invalidate all continueWatching queries regardless of lang
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "continueWatching" });
    },
  });
}

// ── Watchlist ───────────────────────────────────────────

export function useWatchlist() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["watchlist", lang],
    queryFn: async (): Promise<WatchlistItemOutput[]> => {
      const resp = await api.get<WatchlistResponse>("/watchlist", { lang });
      return resp.data;
    },
  });
}

/**
 * "Is this media in the user's watchlist?" derived from the cached
 * full watchlist instead of a per-id endpoint.
 *
 * The previous implementation called `GET /watchlist/check/{id}`
 * for every consumer, which fired one network request per
 * `MediaCard` and produced an N+1 storm on Home / Browse (one
 * request per visible card across every carousel). The fix is to
 * read from the same `useWatchlist()` query that the watchlist page
 * already uses — TanStack Query deduplicates by query key, so all
 * cards on the page share a single underlying request and the
 * membership check is a synchronous `array.some(...)` over the
 * cached list (typically <100 items, so the O(N) cost is
 * microseconds and dominated by render overhead).
 *
 * Why not a `Set` for O(1) lookup? Each `useIsInWatchlist` call is
 * its own hook instance, so a `useMemo`-built `Set` would be
 * rebuilt per component and the total work would still be O(M*N).
 * Sharing the `Set` across components would require a TanStack
 * Query `select` with a module-level function reference — possible,
 * but the actual perf delta at this scale is unmeasurable, and the
 * extra indirection isn't worth it for a list this small.
 *
 * The return shape stays `{ data: boolean | undefined }` so the
 * existing consumers (MediaCard, HeroBanner, MovieDetail,
 * SeriesDetail) don't need to change. `data` stays `undefined`
 * both while the watchlist is loading AND when `mediaId` is
 * falsy — matching the previous hook's `enabled: !!mediaId`
 * behaviour so callers that distinguish "unknown" from "not in
 * list" continue to work.
 */
export function useIsInWatchlist(mediaId: string) {
  const { data: watchlist } = useWatchlist();
  const inWatchlist = useMemo(() => {
    // Match the old `enabled: !!mediaId` semantics: a falsy id
    // never resolves to a boolean — it stays "unknown" forever so
    // callers that branch on `data === undefined` (e.g. show a
    // placeholder while the parent props are still settling) keep
    // working unchanged.
    if (!mediaId) return undefined;
    if (!watchlist) return undefined;
    return watchlist.some((item) => item.media_id === mediaId);
  }, [watchlist, mediaId]);
  return { data: inWatchlist };
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { media_id: string; media_type: string }) =>
      api.post<ToggleWatchlistResponse>("/watchlist/toggle", data),
    onSuccess: () => {
      // Only one query key to invalidate now — the per-id check
      // queries no longer exist, so the cache flush is single-shot.
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

// ── Custom Lists ──────────────────────────────────────────

export function useCustomLists() {
  return useQuery({
    queryKey: ["customLists"],
    queryFn: async (): Promise<CustomListOutput[]> => {
      const resp = await api.get<CustomListsResponse>("/custom-lists");
      return resp.data;
    },
  });
}

export function useCustomListItems(listId: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["customLists", listId, "items", lang],
    queryFn: async (): Promise<CustomListItemOutput[]> => {
      const resp = await api.get<CustomListItemsResponse>(`/custom-lists/${listId}/items`, { lang });
      return resp.data;
    },
    enabled: !!listId,
  });
}

export function useCreateCustomList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<CustomListDetailResponse>("/custom-lists", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customLists"] });
    },
  });
}

export function useRenameCustomList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      api.patch<CustomListDetailResponse>(`/custom-lists/${listId}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customLists"] });
    },
  });
}

export function useDeleteCustomList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => api.del(`/custom-lists/${listId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customLists"] });
    },
  });
}

export function useAddItemToCustomList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, media_id, media_type }: { listId: string; media_id: string; media_type: string }) =>
      api.post<AddItemToCustomListResponse>(`/custom-lists/${listId}/items`, { media_id, media_type }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["customLists"] });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "customLists" && q.queryKey[1] === vars.listId && q.queryKey[2] === "items",
      });
    },
  });
}

export function useRemoveItemFromCustomList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, mediaId }: { listId: string; mediaId: string }) =>
      api.del(`/custom-lists/${listId}/items/${mediaId}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["customLists"] });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "customLists" && q.queryKey[1] === vars.listId && q.queryKey[2] === "items",
      });
    },
  });
}

// ── Libraries ───────────────────────────────────────────

/**
 * Fetch all non-deleted libraries from the backend.
 *
 * Replaces the old localStorage-based `loadLibraries()` — libraries
 * are now persisted server-side so they survive across devices and
 * browser clears.
 */
export function useLibraries() {
  return useQuery({
    queryKey: ["libraries"],
    queryFn: async (): Promise<Library[]> => {
      const resp = await api.get<LibrariesResponse>("/libraries");
      return resp.data;
    },
  });
}

interface LibraryWriteBody {
  name?: string;
  library_type?: string;
  paths?: string[];
  language?: string;
  scan_schedule?: string | null;
  /** Per-library provider config passed through as-is. Backend
   *  validates the shape — the frontend only needs to round-trip it. */
  metadata_providers?: Array<{ provider: string; priority: number; enabled: boolean }>;
  /** ``LibrarySettings`` partial; mirrors the read-side type. */
  settings?: Partial<LibrarySettings>;
}

export function useCreateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      body: LibraryWriteBody & { name: string; library_type: string; paths: string[] },
    ) => api.post<LibraryResponse>("/libraries", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
    },
  });
}

/**
 * Single-library read used by the admin detail page. The list-side
 * ``useLibraries`` returns the full set with no per-id caching, so
 * the detail page wants its own key for cache invalidation after
 * ``useUpdateLibrary`` writes.
 */
export function useLibrary(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library", libraryId],
    queryFn: async (): Promise<Library> => {
      const resp = await api.get<LibraryResponse>(`/libraries/${libraryId}`);
      return resp.data;
    },
    enabled: !!libraryId,
  });
}

export function useUpdateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: LibraryWriteBody }) =>
      api.put<LibraryResponse>(`/libraries/${vars.id}`, vars.body),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      queryClient.invalidateQueries({ queryKey: ["library", vars.id] });
    },
  });
}

export function useDeleteLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (libraryId: string) => api.del(`/libraries/${libraryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
    },
  });
}

// ── Preferences ─────────────────────────────────────────

/**
 * Fetch the current user's playback preferences from the backend.
 *
 * Returns snake_case field names matching the API contract. The
 * `usePlaybackPreferences` hook in `src/hooks/` translates between
 * this shape and the camelCase `PlaybackPreferences` the rest of
 * the frontend consumes.
 */
export function usePreferencesQuery() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: async (): Promise<PlaybackPreferencesData> => {
      const resp = await api.get<PreferencesResponse>("/preferences");
      return resp.data;
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PlaybackPreferencesData>) =>
      api.put<PreferencesResponse>("/preferences", body),
    onSuccess: (resp) => {
      // Optimistic in-cache update so every subscriber sees the
      // new value immediately without waiting for a refetch.
      queryClient.setQueryData(["preferences"], resp.data);
    },
  });
}

// ── Collections (TMDB franchises) ────────────────────────

/**
 * Fetch the Collection Detail payload for a TMDB collection id.
 *
 * The backend stitches TMDB franchise metadata, the local catalog,
 * and any catalog-request state into a single response — see
 * ``GetCollectionByTmdbIdUseCase``. The page renders one ``FilmRow``
 * per part, with available titles linking to Movie Detail and
 * missing ones surfacing the "Solicitar inclusão" / "Avisar quando
 * chegar" CTAs.
 */
export function useCollection(tmdbId: number | undefined) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["collection", tmdbId, lang],
    queryFn: async (): Promise<CollectionDetail> => {
      const resp = await api.get<CollectionDetailResponse>(`/collections/${tmdbId!}`, {
        lang,
      });
      return resp.data;
    },
    enabled: !!tmdbId,
  });
}

interface RequestCatalogVars {
  /** TMDB id of the title to register. */
  tmdb_id: number;
  /** Whether the target is a movie or series. */
  media_type: "movie" | "series";
  /** TMDB collection id this request originated from, when applicable. */
  collection_tmdb_id?: number | null;
  /** Subscribe to the arrival notification at the same time. */
  notify_on_arrival?: boolean;
}

/**
 * Register a catalog inclusion request for a TMDB title.
 *
 * Idempotent on ``(tmdb_id, media_type)``: a repeat call returns
 * the existing request unchanged. The Collection Detail page calls
 * this on the "Solicitar inclusão" click and updates its local
 * cache from the response — the next render shows "Pedido
 * registrado" immediately, without a round-trip back through
 * ``useCollection``.
 */
export function useRequestCatalogInclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: RequestCatalogVars): Promise<CatalogRequest> => {
      const resp = await api.post<CatalogRequestResponse>("/catalog-requests", vars);
      return resp.data;
    },
    onSuccess: (req) => {
      // Refresh the Collection Detail card if the user is currently
      // looking at the franchise that surfaced the request.
      if (req.collection_tmdb_id != null) {
        queryClient.invalidateQueries({
          queryKey: ["collection", req.collection_tmdb_id],
        });
      }
    },
  });
}

interface SubscribeNotifyVars {
  tmdb_id: number;
  media_type: "movie" | "series";
  collection_tmdb_id?: number | null;
}

/**
 * Subscribe to the "title now available" notification for a TMDB id.
 *
 * Creates the catalog request if it doesn't exist yet, or just
 * flips ``notify_on_arrival`` to ``true`` when one is already
 * registered. Used by the "Avisar quando chegar" CTA on the
 * Collection Detail missing-state FilmRow.
 */
export function useSubscribeCatalogNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: SubscribeNotifyVars): Promise<CatalogRequest> => {
      const { tmdb_id, ...body } = vars;
      const resp = await api.post<CatalogRequestResponse>(
        `/catalog-requests/${tmdb_id}/notify`,
        body,
      );
      return resp.data;
    },
    onSuccess: (req) => {
      if (req.collection_tmdb_id != null) {
        queryClient.invalidateQueries({
          queryKey: ["collection", req.collection_tmdb_id],
        });
      }
    },
  });
}

// ─── Admin — Movie Relink ─────────────────────────────────

/**
 * List movies the backend flagged for admin relink.
 *
 * Surfaced by the backend whenever ``EnrichMovieMetadataUseCase``
 * can't resolve a TMDB match (off-year title, cross-type miss,
 * ambiguous folder). Expected to be small — newest-flagged first.
 */
export function useMoviesNeedingReview() {
  return useQuery({
    queryKey: ["admin", "movies", "needs-review"],
    queryFn: async (): Promise<NeedsReviewMovie[]> => {
      const resp = await api.get<NeedsReviewMoviesResponse>(
        "/admin/movies/needs-review",
      );
      return resp.data;
    },
  });
}

/**
 * Fetch the live TMDB suggestion payload for a flagged movie.
 *
 * On-demand: only fires when ``movieId`` is non-null (the picker
 * opens for one row at a time). The backend issues
 * ``/search/movie`` + ``/search/tv`` in parallel, with a no-year
 * retry when the year-hinted query is empty.
 */
export function useMovieTmdbSuggestions(movieId: string | null) {
  return useQuery({
    queryKey: ["admin", "movies", movieId, "tmdb-suggestions"],
    queryFn: async (): Promise<TmdbSuggestionsPayload> => {
      const resp = await api.get<TmdbSuggestionsResponse>(
        `/admin/movies/${movieId}/tmdb-suggestions`,
      );
      return resp.data;
    },
    enabled: !!movieId,
    // Suggestions are tied to the movie's title/year which don't
    // change between opens of the same picker — staleTime keeps the
    // request from re-firing when the user closes and re-opens the
    // dialog within the same session.
    staleTime: 5 * 60 * 1000,
  });
}

interface RelinkMovieVars extends RelinkMovieInput {
  movieId: string;
}

/**
 * Commit an admin's TMDB pick on a flagged movie.
 *
 * Movie picks (`media_type: "movie"`) stamp the chosen TMDB id and
 * force-enrich. TV picks (`media_type: "tv"`) return a 422 from
 * the backend pointing at the future promote-to-series flow —
 * callers should surface that error to the operator.
 *
 * Invalidates both the review listing (the row falls off after a
 * successful enrichment) and the specific movie's detail cache.
 */
export function useRelinkMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      movieId,
      tmdb_id,
      media_type,
    }: RelinkMovieVars): Promise<RelinkMoviePayload> => {
      const resp = await api.post<RelinkMovieResponse>(
        `/admin/movies/${movieId}/relink`,
        { tmdb_id, media_type },
      );
      return resp.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "movies", "needs-review"],
      });
      queryClient.invalidateQueries({ queryKey: ["movie", vars.movieId] });
    },
  });
}

interface PromoteMovieToSeriesVars extends PromoteMovieToSeriesInput {
  movieId: string;
}

/**
 * Convert a misclassified movie into a series using a TMDB tv id.
 *
 * Distinct from `useRelinkMovie` because the backend changes the
 * aggregate identity: the old `mov_xxx` row is soft-deleted and a
 * new `ser_xxx` row replaces it. Cross-BC handlers wipe stale
 * watch progress rows and rewrite watchlist / custom-list entries
 * to the new series id so the user's collections survive.
 *
 * Invalidates the review queue (the row falls off), the old movie
 * detail cache (it's now soft-deleted), every series-list cache
 * (the new series should appear), and watchlist / continue-watching
 * caches since they were rewritten by the backend handlers.
 */
export function usePromoteMovieToSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      movieId,
      tmdb_id,
    }: PromoteMovieToSeriesVars): Promise<PromoteMovieToSeriesPayload> => {
      const resp = await api.post<PromoteMovieToSeriesResponse>(
        `/admin/movies/${movieId}/promote-to-series`,
        { tmdb_id },
      );
      return resp.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "movies", "needs-review"],
      });
      queryClient.invalidateQueries({ queryKey: ["movie", vars.movieId] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["continue-watching"] });
      queryClient.invalidateQueries({ queryKey: ["custom-lists"] });
    },
  });
}

// ─── Admin — Catalog list pages ─────────────────────────────

export interface AdminMoviesFilters {
  /** Restrict to a single library (``lib_xxx``). */
  libraryId?: string;
  /** ``true`` keeps only enriched rows, ``false`` only un-enriched. */
  hasTmdbId?: boolean;
  /** ``true`` keeps only rows the enricher flagged for review. */
  needsReview?: boolean;
}

export interface AdminSeriesFilters {
  libraryId?: string;
  hasTmdbId?: boolean;
}

const ADMIN_PAGE_LIMIT = 30;

function appendCommonAdminParams(
  params: Record<string, string>,
  pageParam: string | null,
  filters: { libraryId?: string; hasTmdbId?: boolean },
): void {
  if (pageParam) params.cursor = pageParam;
  if (filters.libraryId) params.library_id = filters.libraryId;
  if (filters.hasTmdbId !== undefined) params.has_tmdb_id = String(filters.hasTmdbId);
}

/**
 * Cursor-paginated infinite query for the admin Movies catalog page.
 *
 * Distinct from a user-facing list because the page exposes filters
 * (library, TMDB-id presence, review queue) and renders the slim
 * ``MovieSummary`` shape that now carries operator-only metadata
 * (``library_id``, ``tmdb_id``, ``imdb_id``, ``needs_enrichment_review``).
 *
 * The filter object is part of the query key so changing a filter
 * starts a fresh paginated walk instead of trying to splice new
 * pages into the previous filter's cursor.
 */
export function useAdminMovies(filters: AdminMoviesFilters = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useInfiniteQuery({
    queryKey: [
      "admin",
      "catalog",
      "movies",
      lang,
      filters.libraryId ?? "",
      filters.hasTmdbId ?? "",
      filters.needsReview ?? "",
    ],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = { lang, limit: String(ADMIN_PAGE_LIMIT) };
      appendCommonAdminParams(params, pageParam, filters);
      if (filters.needsReview !== undefined) params.needs_review = String(filters.needsReview);
      return api.get<ListMoviesResponse>("/movies", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  const items = useMemo<MovieSummary[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  return {
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Cursor-paginated infinite query for the admin Series catalog page.
 *
 * Same shape as ``useAdminMovies`` but the filter set is smaller —
 * series don't carry a ``needs_enrichment_review`` flag yet.
 */
export function useAdminSeries(filters: AdminSeriesFilters = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useInfiniteQuery({
    queryKey: [
      "admin",
      "catalog",
      "series",
      lang,
      filters.libraryId ?? "",
      filters.hasTmdbId ?? "",
    ],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = { lang, limit: String(ADMIN_PAGE_LIMIT) };
      appendCommonAdminParams(params, pageParam, filters);
      return api.get<ListSeriesResponse>("/series", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  const items = useMemo<SeriesSummary[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  return {
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Admin soft-delete a movie. Invalidates the catalog + needs-review
 * queues so the row disappears from the visible tables without a
 * full page refresh.
 */
export function useDeleteMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movieId: string) => api.del(`/movies/${movieId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "movies"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "movies", "needs-review"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
    },
  });
}

/**
 * Admin soft-delete a series. Mirrors ``useDeleteMovie`` — the
 * children (seasons / episodes / media_files) stay on disk because
 * the API only exposes soft-delete.
 */
export function useDeleteSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seriesId: string) => api.del(`/series/${seriesId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "series"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
  });
}

// ─── Admin — Catalog requests ───────────────────────────────

/**
 * List every pending catalog request across the household.
 *
 * Admin-only — hits ``GET /admin/catalog-requests`` rather than
 * the user-facing endpoint. Used by the ``/admin/requests`` page
 * so the operator can survey what titles the household is
 * tracking, plus dismiss entries that are no longer wanted.
 */
export function useAdminCatalogRequests() {
  return useQuery({
    queryKey: ["admin", "catalog-requests"],
    queryFn: async (): Promise<CatalogRequest[]> => {
      const resp = await api.get<CatalogRequestsResponse>("/admin/catalog-requests");
      return resp.data;
    },
  });
}

/**
 * Soft-delete a pending catalog request by external id. Invalidates
 * the admin queue so the row falls off the list immediately.
 */
export function useDismissCatalogRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => api.del(`/admin/catalog-requests/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-requests"] });
    },
  });
}

// ─── Admin — System (HLS cache + health) ───────────────────

/**
 * Snapshot of the HLS cache: bytes-on-disk, configured ceiling,
 * and the timestamp of the last global clear. Drives the occupancy
 * card on the admin System page; the underlying endpoint walks the
 * cache directory server-side, so the page polls on demand only.
 */
export function useHlsCacheStats() {
  return useQuery({
    queryKey: ["admin", "hls-cache"],
    queryFn: async (): Promise<HlsCacheStats> => {
      const resp = await api.get<HlsCacheStatsResponse>("/admin/hls-cache");
      return resp.data;
    },
  });
}

/**
 * Wipe every cached HLS bucket. Used by the admin System page's
 * "Clear cache" button — distinct from the per-movie clear under
 * ``/stream/...``. Re-reads the stats so the occupancy bar drops
 * back to zero immediately on success.
 */
export function useClearHlsCacheGlobal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.del("/admin/hls-cache"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hls-cache"] });
    },
  });
}

// ─── Admin — Users ──────────────────────────────────────────

/**
 * Page through every user, optionally filtered by role. The list
 * page renders the role chip + profile count per row so the
 * operator can eyeball multi-profile households without opening
 * each detail.
 */
export function useAdminUsers(role?: "admin" | "member") {
  return useQuery({
    queryKey: ["admin", "users", role ?? "all"],
    queryFn: async (): Promise<AdminUserSummary[]> => {
      const query = role ? `?role=${role}` : "";
      const resp = await api.get<AdminUsersResponse>(`/admin/users${query}`);
      return resp.data;
    },
  });
}

/**
 * Hydrate a single admin user + their (read-only) profile list.
 * Used by the ``/admin/users/:id`` detail page.
 */
export function useAdminUser(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AdminUserDetail> => {
      const resp = await api.get<AdminUserDetailResponse>(`/admin/users/${userId}`);
      return resp.data;
    },
  });
}

/**
 * Admin creates a user from the invite drawer. The body's
 * ``password`` is the initial credential the operator hands the
 * member; the user is expected to change it from ``/settings``
 * after first login. On success we drop the list cache so the
 * new row appears immediately.
 */
export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAdminUserPayload) => {
      const resp = await api.post<AdminUserSummaryResponse>("/admin/users", payload);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

/**
 * Flip a user's role. The server refuses to demote the last
 * active admin with HTTP 409 — the route translates that to a
 * typed error the UI surfaces in the confirm dialog.
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; role: "admin" | "member" }) => {
      const payload: UpdateUserRolePayload = { role: vars.role };
      const resp = await api.patch<AdminUserSummaryResponse>(
        `/admin/users/${vars.userId}`,
        payload,
      );
      return resp.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", vars.userId] });
    },
  });
}

/**
 * Soft-delete a user. The server refuses self-deletion and
 * last-admin removal (HTTP 409). On success the list + detail
 * caches are dropped so the row disappears immediately.
 */
export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.del(`/admin/users/${userId}`),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
  });
}
