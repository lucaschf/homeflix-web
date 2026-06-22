import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "./client";
import { notifyOtherTabs } from "./notificationsChannel";
import type {
  AddItemToCustomListResponse,
  AdminConflictAction,
  AdminBulkMarkDistinctResponse,
  AdminConflictListState,
  AdminConflictResolutionSource,
  AdminConflictSummary,
  AdminConflictSweepResponse,
  AdminConflictsResponse,
  BulkMarkDistinctPayload,
  ResolveAdminConflictPayload,
  ResolveAdminConflictResponse,
  AdminIntroDetectionRun,
  AdminIntroDetectionRunsResponse,
  AdminOverviewStats,
  AdminOverviewStatsResponse,
  AdminScanRun,
  AdminScanRunKind,
  AdminScanRunResponse,
  AdminScanRunsResponse,
  AdminScanRunTrigger,
  AdminSettingDetail,
  AdminSettingDetailResponse,
  AdminSettingKey,
  AdminSettingsResponse,
  AdminSettingsValue,
  AdminUserDetail,
  AdminUserDetailResponse,
  AdminUserSummary,
  AdminUserSummaryResponse,
  AdminUsersResponse,
  ApiDetailResponse,
  BulkEnrichResponse,
  CatalogByGenreResponse,
  CatalogItem,
  CatalogLookupResponse,
  CatalogLookupResult,
  CatalogRequest,
  CatalogRequestResponse,
  CatalogRequestsResponse,
  CollectionDetail,
  CollectionDetailResponse,
  ContinueWatchingItem,
  ContinueWatchingResponse,
  CreateAdminUserPayload,
  CreditsMarkerOutput,
  CreditsStatusData,
  CustomListDetailResponse,
  CustomListItemOutput,
  CustomListItemsResponse,
  CustomListOutput,
  CustomListsResponse,
  EnrichResponse,
  FeaturedItem,
  FeaturedResponse,
  FileTracks,
  Genre,
  GenresResponse,
  HealthResponse,
  HlsCacheStats,
  HlsCacheStatsResponse,
  IntroMarkerOutput,
  JobRunRecord,
  JobRunsResponse,
  JobsOverview,
  JobsOverviewResponse,
  LibrariesResponse,
  Library,
  LibraryResponse,
  LibrarySettings,
  ListMoviesResponse,
  ListSeriesResponse,
  PlaybackPreferencesData,
  PreferencesResponse,
  MarkAllNotificationsReadPayload,
  MarkAllNotificationsReadResponse,
  MovieDetail,
  MovieDetailResponse,
  MovieSummary,
  MoviesByActorResponse,
  NeedsReviewMovie,
  NeedsReviewMoviesResponse,
  Notification,
  NotificationResponse,
  NotificationsResponse,
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
  FlagMovieEnrichmentPayload,
  FlagMovieEnrichmentResponse,
  FlagSeriesEnrichmentPayload,
  FlagSeriesEnrichmentResponse,
  NeedsReviewSeries,
  NeedsReviewSeriesResponse,
  RelinkMovieInput,
  RelinkMoviePayload,
  RelinkMovieResponse,
  RelinkSeriesInput,
  RelinkSeriesPayload,
  RelinkSeriesResponse,
  SeriesTmdbSuggestionsPayload,
  SeriesTmdbSuggestionsResponse,
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
  TriggerBulkEnrichPayload,
  TriggerScanPayload,
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
 * Per-file audio + subtitle tracks for the player, including the
 * structured ``version`` that differentiates same-language tracks
 * (dub studio, channel layout, or ordinal). The player matches these
 * to its hls.js renditions and composes localized display labels.
 *
 * Disabled until the relevant ids are known. The response is returned
 * raw by the backend (no ``{data}`` envelope), so it is consumed
 * directly. Track metadata is immutable per file, so it is cached
 * indefinitely.
 */
export function useFileTracks(params: {
  isMovie: boolean;
  movieId?: string;
  seriesId?: string;
  season?: string | number;
  episode?: string | number;
}) {
  const { isMovie, movieId, seriesId, season, episode } = params;
  const path = isMovie
    ? `/stream/movie/${movieId}/tracks`
    : `/stream/episode/${seriesId}/${season}/${episode}/tracks`;
  const enabled = isMovie
    ? Boolean(movieId)
    : Boolean(seriesId && season != null && episode != null);
  return useQuery({
    queryKey: ["fileTracks", path],
    queryFn: () => api.get<FileTracks>(path),
    enabled,
    staleTime: Infinity,
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
 * Offset-paginated history of intro-detection runs (audit log).
 *
 * One row per season the detection job processed; each row carries
 * counts plus the per-episode detail (confidence + whether persisted)
 * so the admin can see why a tick dropped markers.
 */
export function useIntroDetectionRuns(
  filters: { seasonId?: string; seriesId?: string } = {},
  options: { pageSize?: number } = {},
) {
  const pageSize = options.pageSize ?? ADMIN_PAGE_LIMIT;
  const { seasonId, seriesId } = filters;
  const filterKey = `${seasonId ?? "all"}|${seriesId ?? "all"}|${pageSize}`;
  const query = useInfiniteQuery({
    queryKey: ["admin", "intro-detection-runs", filterKey],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params = new URLSearchParams();
      if (seasonId) params.set("season_id", seasonId);
      if (seriesId) params.set("series_id", seriesId);
      params.set("limit", String(pageSize));
      params.set("offset", String(pageParam));
      const resp = await api.get<AdminIntroDetectionRunsResponse>(
        `/admin/intro-detection/runs?${params.toString()}`,
      );
      return {
        data: resp.data,
        nextOffset: resp.data.length === pageSize ? pageParam + pageSize : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  return usePagedInfiniteQuery<AdminIntroDetectionRun>(query, filterKey);
}

/**
 * Background-jobs dashboard overview: every scheduler job with its live
 * schedule (next run) merged with its last recorded execution and a
 * "running now" flag. Polled so the next-run countdown and running state
 * stay fresh while the page is open.
 */
export function useJobs() {
  return useQuery({
    queryKey: ["admin", "jobs"],
    queryFn: async (): Promise<JobsOverview> => {
      const resp = await api.get<JobsOverviewResponse>("/admin/jobs");
      return resp.data;
    },
    refetchInterval: 10_000,
  });
}

/**
 * Offset-paginated job execution history, newest-first, optionally
 * narrowed to one ``jobId``. Mirrors ``useIntroDetectionRuns``.
 */
export function useJobRuns(
  filters: { jobId?: string } = {},
  options: { pageSize?: number } = {},
) {
  const pageSize = options.pageSize ?? ADMIN_PAGE_LIMIT;
  const { jobId } = filters;
  const filterKey = `${jobId ?? "all"}|${pageSize}`;
  const query = useInfiniteQuery({
    queryKey: ["admin", "job-runs", filterKey],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params = new URLSearchParams();
      if (jobId) params.set("job_id", jobId);
      params.set("limit", String(pageSize));
      params.set("offset", String(pageParam));
      const resp = await api.get<JobRunsResponse>(`/admin/jobs/runs?${params.toString()}`);
      return {
        data: resp.data,
        nextOffset: resp.data.length === pageSize ? pageParam + pageSize : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  return usePagedInfiniteQuery<JobRunRecord>(query, filterKey);
}

/**
 * Trigger a scheduled job to run immediately ("run now"). On success
 * the job's recorded run shows up in the dashboard within a poll
 * cycle, so we invalidate both the overview and the run history.
 */
export function useTriggerJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      api.post<ApiDetailResponse<{ job_id: string; triggered: boolean }>>(
        `/admin/jobs/${encodeURIComponent(jobId)}/run`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "job-runs"] });
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

interface ResetSeasonIntroVars {
  seasonId: string;
  seriesId: string;
}

interface ResetSeasonIntroResult {
  markers_cleared: number;
}

/**
 * Requeue one season for automatic intro detection: returns it to
 * ``NOT_STARTED`` so the next job tick reprocesses it and clears its
 * AUTO_DETECTED markers (MANUAL ones are kept). Used to re-run after
 * switching the detection algorithm or re-tuning — a ``COMPLETED``
 * season would otherwise never be picked up again.
 */
export function useResetSeasonIntroDetection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ seasonId }: ResetSeasonIntroVars) =>
      api.post<ApiDetailResponse<ResetSeasonIntroResult>>(
        `/series/seasons/${seasonId}/intro-detection/reset`,
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["series", vars.seriesId] });
    },
  });
}

// ── Credits markers (admin) ─────────────────────────────
//
// Credits apply to BOTH movies and episodes, so these hooks are
// media-agnostic: the caller passes the target ``mediaId`` (mov_/epi_)
// plus whichever cache key to refresh — ``movieId`` for a movie,
// ``seriesId`` for an episode (its credits live inside the series
// detail). The endpoints are admin-prefixed and media-centric.

interface CreditsCacheVars {
  /** Movie id to invalidate (when the target is a movie). */
  movieId?: string;
  /** Series id to invalidate (when the target is an episode). */
  seriesId?: string;
}

function invalidateCreditsCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  vars: CreditsCacheVars,
): void {
  if (vars.movieId) {
    // Prefix match invalidates every cached language of the movie.
    queryClient.invalidateQueries({ queryKey: ["movie", vars.movieId] });
  }
  if (vars.seriesId) {
    queryClient.invalidateQueries({ queryKey: ["series", vars.seriesId] });
  }
}

interface SetCreditsMarkerVars extends CreditsCacheVars {
  /** External media id (mov_xxx or epi_xxx) — target of the PUT. */
  mediaId: string;
  start_seconds: number;
}

/**
 * Persist a manual credits marker on a movie or episode. Backend
 * stamps ``source = MANUAL`` and moves the title to ``COMPLETED`` so
 * the auto-detection job skips it thereafter.
 */
export function useSetCreditsMarker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, start_seconds }: SetCreditsMarkerVars) =>
      api.put<ApiDetailResponse<CreditsMarkerOutput>>(`/admin/media/${mediaId}/credits`, {
        start_seconds,
      }),
    onSuccess: (_, vars) => invalidateCreditsCaches(queryClient, vars),
  });
}

interface ClearCreditsMarkerVars extends CreditsCacheVars {
  mediaId: string;
}

/**
 * Remove the credits marker from a movie/episode. The title stays
 * ``COMPLETED`` (no marker) so the job does not re-add one — use the
 * reset hook to re-run detection instead.
 */
export function useClearCreditsMarker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId }: ClearCreditsMarkerVars) =>
      api.del(`/admin/media/${mediaId}/credits`),
    onSuccess: (_, vars) => invalidateCreditsCaches(queryClient, vars),
  });
}

interface ResetCreditsDetectionVars extends CreditsCacheVars {
  mediaId: string;
}

interface ResetCreditsDetectionResult {
  marker_cleared: boolean;
}

/**
 * Requeue one movie/episode for automatic credits detection: returns
 * it to ``NOT_STARTED`` so the next job tick reprocesses it, clearing
 * an AUTO_DETECTED marker (MANUAL ones are kept).
 */
export function useResetCreditsDetection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId }: ResetCreditsDetectionVars) =>
      api.post<ApiDetailResponse<ResetCreditsDetectionResult>>(
        `/admin/media/${mediaId}/credits-detection/reset`,
      ),
    onSuccess: (_, vars) => invalidateCreditsCaches(queryClient, vars),
  });
}

interface CreditsStatusParams {
  mediaType: "movie" | "episode";
  state: string | null;
  limit: number;
  offset: number;
}

/**
 * Admin observability: titles by credits-detection state (one media
 * type per call) + the unfiltered per-state counts for the filter chips.
 */
export function useCreditsStatus({ mediaType, state, limit, offset }: CreditsStatusParams) {
  return useQuery({
    queryKey: ["admin", "credits-status", mediaType, state ?? "all", limit, offset],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("media_type", mediaType);
      if (state) qs.set("state", state);
      qs.set("limit", String(limit));
      qs.set("offset", String(offset));
      const resp = await api.get<ApiDetailResponse<CreditsStatusData>>(
        `/admin/credits/status?${qs.toString()}`,
      );
      return resp.data;
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
  /** Title snapshot at request time — surfaced in the admin queue
   *  so the operator doesn't need to chase the tmdb id back to a
   *  human-readable label. */
  title?: string | null;
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

/**
 * Resolve a user-pasted query (TMDB id / IMDb id / TMDB URL / IMDb
 * URL / plain title) into picker candidates the "Request a title"
 * dialog renders. Disabled while ``q`` is empty so the dialog can
 * cheaply gate on ``query.length > 0``; staleness defaults are
 * fine — the dialog is short-lived and re-queries on focus anyway.
 */
export function useCatalogLookup(q: string, limit: number = 5) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const trimmed = debounced.trim();
  return useQuery({
    queryKey: ["catalog-lookup", trimmed, limit],
    enabled: trimmed.length > 0,
    queryFn: async (): Promise<CatalogLookupResult> => {
      const resp = await api.get<CatalogLookupResponse>("/catalog/lookup", {
        q: trimmed,
        limit: String(limit),
      });
      return resp.data;
    },
  });
}

interface SubscribeNotifyVars {
  tmdb_id: number;
  media_type: "movie" | "series";
  /** Title snapshot at subscription time — same purpose as on
   *  ``RequestCatalogVars``: lets the admin queue read the title
   *  without a TMDB round-trip. */
  title?: string | null;
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

/**
 * Flag an already-enriched movie whose metadata matched the wrong
 * title. The backend sets ``needs_enrichment_review`` so the movie
 * shows up again on the admin review queue, where it can be relinked
 * to the correct TMDB id (see {@link useRelinkMovie}).
 *
 * Invalidates the review listing and the movie's detail cache so the
 * flag state surfaces immediately.
 */
export function useFlagMovieEnrichment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (movieId: string): Promise<FlagMovieEnrichmentPayload> => {
      const resp = await api.post<FlagMovieEnrichmentResponse>(
        `/admin/movies/${movieId}/flag-enrichment`,
      );
      return resp.data;
    },
    onSuccess: (_, movieId) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "movies", "needs-review"],
      });
      queryClient.invalidateQueries({ queryKey: ["movie", movieId] });
    },
  });
}

// ─── Series enrichment review ───────────────────────────────

/** List series flagged for enrichment review (admin). */
export function useSeriesNeedingReview() {
  return useQuery({
    queryKey: ["admin", "series", "needs-review"],
    queryFn: async (): Promise<NeedsReviewSeries[]> => {
      const resp = await api.get<NeedsReviewSeriesResponse>("/admin/series/needs-review");
      return resp.data;
    },
  });
}

/** Live TMDB TV candidates for a series needing review. */
export function useSeriesTmdbSuggestions(seriesId: string | null) {
  return useQuery({
    queryKey: ["admin", "series", seriesId, "tmdb-suggestions"],
    queryFn: async (): Promise<SeriesTmdbSuggestionsPayload> => {
      const resp = await api.get<SeriesTmdbSuggestionsResponse>(
        `/admin/series/${seriesId}/tmdb-suggestions`,
      );
      return resp.data;
    },
    enabled: !!seriesId,
    staleTime: 5 * 60 * 1000,
  });
}

interface RelinkSeriesVars extends RelinkSeriesInput {
  seriesId: string;
}

/**
 * Commit an admin's TV pick on a flagged series — stamps the chosen
 * TMDB id and force-enriches. Invalidates the review listing and the
 * series detail cache so the flag/badge state updates immediately.
 */
export function useRelinkSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      seriesId,
      tmdb_id,
      media_type,
    }: RelinkSeriesVars): Promise<RelinkSeriesPayload> => {
      const resp = await api.post<RelinkSeriesResponse>(
        `/admin/series/${seriesId}/relink`,
        { tmdb_id, media_type },
      );
      return resp.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "series", "needs-review"],
      });
      queryClient.invalidateQueries({ queryKey: ["series", vars.seriesId] });
    },
  });
}

/** Flag a wrongly-enriched series so it re-enters the review queue. */
export function useFlagSeriesEnrichment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (seriesId: string): Promise<FlagSeriesEnrichmentPayload> => {
      const resp = await api.post<FlagSeriesEnrichmentResponse>(
        `/admin/series/${seriesId}/flag-enrichment`,
      );
      return resp.data;
    },
    onSuccess: (_, seriesId) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "series", "needs-review"],
      });
      queryClient.invalidateQueries({ queryKey: ["series", seriesId] });
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
  /** Case-insensitive substring match against title / original_title. */
  q?: string;
}

export interface AdminSeriesFilters {
  libraryId?: string;
  hasTmdbId?: boolean;
  /** Case-insensitive substring match against title / original_title. */
  q?: string;
}

const ADMIN_PAGE_LIMIT = 10;

/**
 * Page-size choices surfaced by the admin pagination footer.
 * Keep modest — anything bigger than 100 starts hurting the
 * cursor walk and the table scrolls anyway.
 */
export const ADMIN_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Shape returned by the paged-pagination wrapper used by the
 * admin catalog tables. Wraps the underlying TanStack
 * ``useInfiniteQuery`` so the consumer page renders one cursor
 * page at a time with explicit Previous / Next controls instead
 * of an infinite-scroll sentinel.
 */
export interface PagedQuery<T> {
  items: T[];
  pageNumber: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  goNext: () => void;
  goPrevious: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

interface PageEnvelope<T> {
  data: T[];
}

interface InfiniteQueryShape<T> {
  data?: { pages: PageEnvelope<T>[] };
  hasNextPage?: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

/**
 * Convert a TanStack ``useInfiniteQuery`` into a page-by-page
 * navigation API. Re-uses every page already in the query cache
 * (Previous is instant); only fires ``fetchNextPage`` when the
 * caller advances past the last loaded page.
 *
 * ``resetKey`` controls when the cursor resets — usually a
 * stringified filter signature. Changing it (e.g. the operator
 * flips a filter chip) walks back to page 1.
 */
function usePagedInfiniteQuery<T>(
  query: InfiniteQueryShape<T>,
  resetKey: string,
): PagedQuery<T> {
  const [pageIndex, setPageIndex] = useState(0);
  // Snap back to page 1 whenever the underlying filter changes —
  // otherwise the operator would land on whatever index they
  // were on under the old filter set. Done via the
  // derived-state-from-prop pattern (one render with the old
  // index, then a state flush) instead of ``useEffect`` so React
  // 19's ``set-state-in-effect`` rule doesn't fire.
  const [trackedKey, setTrackedKey] = useState(resetKey);
  if (trackedKey !== resetKey) {
    setTrackedKey(resetKey);
    setPageIndex(0);
  }

  const pagesLoaded = query.data?.pages.length ?? 0;
  const currentPage = query.data?.pages[pageIndex];
  const items = currentPage?.data ?? [];

  const canGoPrevious = pageIndex > 0;
  const canGoNext = (query.hasNextPage ?? false) || pageIndex < pagesLoaded - 1;

  const goNext = useCallback(() => {
    if (pageIndex < pagesLoaded - 1) {
      setPageIndex((p) => p + 1);
      return;
    }
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage().then(() => {
        setPageIndex((p) => p + 1);
      });
    }
  }, [pageIndex, pagesLoaded, query]);

  const goPrevious = useCallback(() => {
    if (pageIndex > 0) setPageIndex((p) => p - 1);
  }, [pageIndex]);

  return {
    items,
    pageNumber: pageIndex + 1,
    canGoNext,
    canGoPrevious,
    goNext,
    goPrevious,
    isLoading: query.isLoading,
    isFetching: query.isFetching || query.isFetchingNextPage,
    isError: query.isError,
    refetch: () => {
      setPageIndex(0);
      void query.refetch();
    },
  };
}

/**
 * Client-side pagination for tables whose endpoint returns the
 * full list in one shot (Users, Catalog Requests, Movie Review).
 * Slices the array into pages without firing any extra requests
 * — pairs with ``AdminTablePagination`` so the operator sees the
 * same Prev / Next / page-size affordance as the cursor-paged
 * tables. ``resetKey`` snaps back to page 1 on filter change,
 * same convention as ``usePagedInfiniteQuery``.
 */
export function usePagedList<T>(
  allItems: T[],
  pageSize: number,
  resetKey: string = "",
): Pick<
  PagedQuery<T>,
  "items" | "pageNumber" | "canGoNext" | "canGoPrevious" | "goNext" | "goPrevious"
> {
  const [pageIndex, setPageIndex] = useState(0);
  const [trackedKey, setTrackedKey] = useState(`${resetKey}|${pageSize}`);
  const currentKey = `${resetKey}|${pageSize}`;
  if (trackedKey !== currentKey) {
    setTrackedKey(currentKey);
    setPageIndex(0);
  }

  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  // Clamp the index so a row delete that shrinks ``allItems``
  // doesn't leave the operator stranded past the last page.
  const safeIndex = Math.min(pageIndex, totalPages - 1);
  const start = safeIndex * pageSize;
  const items = allItems.slice(start, start + pageSize);

  return {
    items,
    pageNumber: safeIndex + 1,
    canGoNext: safeIndex < totalPages - 1,
    canGoPrevious: safeIndex > 0,
    goNext: () => setPageIndex(safeIndex + 1),
    goPrevious: () => setPageIndex(Math.max(0, safeIndex - 1)),
  };
}

function appendCommonAdminParams(
  params: Record<string, string>,
  pageParam: string | null,
  filters: { libraryId?: string; hasTmdbId?: boolean; q?: string },
): void {
  if (pageParam) params.cursor = pageParam;
  if (filters.libraryId) params.library_id = filters.libraryId;
  if (filters.hasTmdbId !== undefined) params.has_tmdb_id = String(filters.hasTmdbId);
  const trimmedQ = filters.q?.trim();
  if (trimmedQ) params.q = trimmedQ;
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
export function useAdminMovies(
  filters: AdminMoviesFilters = {},
  options: { pageSize?: number } = {},
) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const pageSize = options.pageSize ?? ADMIN_PAGE_LIMIT;
  const normalizedQ = filters.q?.trim() ?? "";
  const filterKey = `${filters.libraryId ?? ""}|${filters.hasTmdbId ?? ""}|${filters.needsReview ?? ""}|${normalizedQ}|${pageSize}`;
  const query = useInfiniteQuery({
    queryKey: ["admin", "catalog", "movies", lang, filterKey],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = { lang, limit: String(pageSize) };
      appendCommonAdminParams(params, pageParam, filters);
      if (filters.needsReview !== undefined) params.needs_review = String(filters.needsReview);
      return api.get<ListMoviesResponse>("/movies", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  return usePagedInfiniteQuery<MovieSummary>(query, filterKey);
}

/**
 * Cursor-paginated infinite query for the admin Series catalog page.
 *
 * Same shape as ``useAdminMovies`` but the filter set is smaller —
 * series don't carry a ``needs_enrichment_review`` flag yet.
 */
export function useAdminSeries(
  filters: AdminSeriesFilters = {},
  options: { pageSize?: number } = {},
) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const pageSize = options.pageSize ?? ADMIN_PAGE_LIMIT;
  const normalizedQ = filters.q?.trim() ?? "";
  const filterKey = `${filters.libraryId ?? ""}|${filters.hasTmdbId ?? ""}|${normalizedQ}|${pageSize}`;
  const query = useInfiniteQuery({
    queryKey: ["admin", "catalog", "series", lang, filterKey],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = { lang, limit: String(pageSize) };
      appendCommonAdminParams(params, pageParam, filters);
      return api.get<ListSeriesResponse>("/series", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  return usePagedInfiniteQuery<SeriesSummary>(query, filterKey);
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

// ─── Admin — Settings (ADR-013 phase 4) ─────────────────────

/**
 * URL-slug for each bucket key. The backend uses
 * ``thumbnail_backfill`` / ``intro_detection`` in JSON payloads and
 * the matching hyphenated slugs on the route path, so the hook
 * normalises the two ends from a single source of truth here.
 */
const ADMIN_SETTINGS_SLUG: Record<AdminSettingKey, string> = {
  scheduler: "scheduler",
  thumbnail_backfill: "thumbnail-backfill",
  intro_detection: "intro-detection",
  credits_detection: "credits-detection",
  streaming: "streaming",
  avatar: "avatar",
  scan_dedup: "scan-dedup",
};

/**
 * Pull every settings bucket in one round-trip. The response always
 * has one entry per ``SettingKey`` — never-edited buckets are
 * synthesised with ``source: "default"`` so the admin page can render
 * every form without a second request.
 *
 * ``staleTime`` is left at the global default (``0``) so the page
 * always refetches on focus; admin edits invalidate this key
 * imperatively (see ``useUpdateAdminSetting``).
 */
export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async (): Promise<AdminSettingDetail[]> => {
      const resp = await api.get<AdminSettingsResponse>("/admin/settings");
      return resp.data;
    },
  });
}

/**
 * Replace a settings bucket. Full-replace semantics: ``payload``
 * carries the entire VO; the backend re-validates against the
 * matching Pydantic model. On success the read cache is dropped so
 * the form re-hydrates from the persisted row (carrying the new
 * ``updated_at`` / ``updated_by_user_id``) without an extra refetch
 * round-trip.
 *
 * Bucket-specific mutations are thin wrappers around this hook —
 * see ``useUpdateSchedulerSettings`` and friends below — so each form
 * can stay typed against its concrete VO while the network call
 * stays in one place.
 */
export function useUpdateAdminSetting<V extends AdminSettingsValue>() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      key: AdminSettingKey;
      payload: V;
    }): Promise<AdminSettingDetail> => {
      const slug = ADMIN_SETTINGS_SLUG[vars.key];
      const resp = await api.patch<AdminSettingDetailResponse>(
        `/admin/settings/${slug}`,
        vars.payload,
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });
}

// ─── Admin — Scan + Enrich runs ─────────────────────────────

/**
 * Paged history of scan + bulk-enrich runs. The list page keeps
 * polling every 3 s as long as at least one row is still
 * ``running`` so the operator sees the row flip to
 * ``succeeded`` / ``failed`` without a manual refresh; once
 * everything is terminal we drop the interval to keep the page
 * idle-cheap.
 *
 * Pagination uses offset-based ``useInfiniteQuery`` against the
 * ``GET /api/v1/admin/scans?limit=N&offset=M`` endpoint, wrapped
 * by ``usePagedInfiniteQuery`` so the page renders one cursor
 * page at a time with explicit Previous / Next.
 */
export function useAdminScanRuns(
  kind?: AdminScanRunKind,
  trigger?: AdminScanRunTrigger,
  options: { pageSize?: number } = {},
) {
  const pageSize = options.pageSize ?? ADMIN_PAGE_LIMIT;
  const filterKey = `${kind ?? "all"}|${trigger ?? "all"}|${pageSize}`;
  const query = useInfiniteQuery({
    queryKey: ["admin", "scan-runs", filterKey],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (trigger) params.set("trigger", trigger);
      params.set("limit", String(pageSize));
      params.set("offset", String(pageParam));
      const resp = await api.get<AdminScanRunsResponse>(`/admin/scans?${params.toString()}`);
      // Offset-based feed has no cursor; the next page exists iff
      // the current page is "full" (``length === pageSize``). On a
      // partially-full page we know we hit the tail.
      return { data: resp.data, nextOffset: resp.data.length === pageSize ? pageParam + pageSize : null };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    refetchInterval: (q) => {
      const pages = q.state.data?.pages ?? [];
      const anyRunning = pages.some((p) => p.data.some((r) => r.status === "running"));
      return anyRunning ? 3000 : false;
    },
  });

  return usePagedInfiniteQuery<AdminScanRun>(query, filterKey);
}

// ─── Admin — Media conflicts (ADR-015 Phases 1-3) ───────────────

/**
 * Paged feed of content-identity conflicts surfaced by the
 * post-enrich detector. Cursor-paged (newest first) and wrapped by
 * ``usePagedInfiniteQuery`` so the page renders one cursor slice at
 * a time with the standard Prev / Next chrome.
 *
 * ``state="pending"`` (default) is the operator queue;
 * ``state="resolved"`` powers the Phase 3 audit view, optionally
 * filtered by ``source`` (manual admin decisions vs. silent auto-
 * merges). Each filter combo lives under its own queryKey so the
 * tabs cache independently.
 */
export function useAdminConflicts(
  filters: {
    state?: AdminConflictListState;
    source?: AdminConflictResolutionSource | null;
  } = {},
  options: { pageSize?: number } = {},
) {
  const state = filters.state ?? "pending";
  const source = filters.source ?? null;
  const pageSize = options.pageSize ?? ADMIN_PAGE_LIMIT;
  const filterKey = `${state}|${source ?? "all"}|${pageSize}`;
  const query = useInfiniteQuery({
    queryKey: ["admin", "conflicts", filterKey],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params = new URLSearchParams();
      params.set("state", state);
      if (source) params.set("source", source);
      params.set("limit", String(pageSize));
      if (pageParam) params.set("cursor", pageParam);
      return api.get<AdminConflictsResponse>(`/admin/conflicts?${params.toString()}`);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.metadata?.pagination?.next_cursor ?? null,
  });

  return usePagedInfiniteQuery<AdminConflictSummary>(query, filterKey);
}

/**
 * Resolve one pending conflict. The mutation invalidates the
 * conflict queue (so the row disappears from the list) plus any
 * catalog read that may have changed: the loser movie is
 * soft-deleted on MERGE, so movie/series listings need a refresh.
 *
 * The cross-BC fan-out (watch_progress + collections) happens on
 * the backend event bus and is not reflected here — the relevant
 * pages reload their own data when next opened.
 */
export function useResolveAdminConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      conflictId: string;
      action: AdminConflictAction;
      winnerId?: string | null;
    }) => {
      const body: ResolveAdminConflictPayload = {
        action: vars.action,
        winner_id: vars.winnerId ?? null,
      };
      const resp = await api.post<ResolveAdminConflictResponse>(
        `/admin/conflicts/${vars.conflictId}/resolve`,
        body,
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "conflicts"] });
      // MERGE actions soft-delete the loser, which alters the
      // catalog. Invalidate the broad catalog/admin trees so any
      // open list re-fetches on next focus.
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "needs-review"] });
    },
  });
}

/**
 * Mark a selection of pending conflicts as intentionally distinct in
 * one call. Bulk is limited to ``mark_distinct`` (no winner, no
 * soft-delete), so it only invalidates the conflict queue — the
 * catalog is untouched. The result reports ``resolved_ids`` plus any
 * ``skipped`` ids (already resolved / missing / malformed).
 */
export function useBulkMarkDistinctConflicts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conflictIds: string[]) => {
      const body: BulkMarkDistinctPayload = { conflict_ids: conflictIds };
      const resp = await api.post<AdminBulkMarkDistinctResponse>(
        "/admin/conflicts/bulk-mark-distinct",
        body,
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "conflicts"] });
    },
  });
}

/**
 * Trigger one catalog-wide dedup sweep on demand
 * (``POST /admin/conflicts/sweep`` — ADR-015 Phase 6.5). Re-runs the
 * detector against every movie regardless of whether the scheduled
 * sweep is enabled. Invalidates the conflict queue so any new
 * pending row surfaces immediately.
 */
export function useSweepConflicts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const resp = await api.post<AdminConflictSweepResponse>(
        "/admin/conflicts/sweep",
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "conflicts"] });
    },
  });
}

/**
 * Hydrate a single run. Used by the detail drawer / row expansion
 * to read the full ``errors`` list (the list endpoint returns the
 * count + first slice; the detail returns the whole thing).
 */
export function useAdminScanRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "scan-run", runId],
    enabled: !!runId,
    queryFn: async (): Promise<AdminScanRun> => {
      const resp = await api.get<AdminScanRunResponse>(`/admin/scans/${runId}`);
      return resp.data;
    },
  });
}

/**
 * Open a ``scan`` ``running`` row and dispatch the background
 * task. Returns the new row so the page can route to detail /
 * highlight it in the list.
 */
export function useTriggerScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (libraryId: string) => {
      const payload: TriggerScanPayload = { library_id: libraryId };
      const resp = await api.post<AdminScanRunResponse>("/admin/scans", payload);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scan-runs"] });
    },
  });
}

/**
 * Open an ``enrich`` ``running`` row and dispatch the bulk
 * metadata refresh. ``force`` re-enriches rows that already have
 * TMDB metadata.
 */
export function useTriggerBulkEnrich() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (force: boolean) => {
      const payload: TriggerBulkEnrichPayload = { force };
      const resp = await api.post<AdminScanRunResponse>("/admin/enrichments", payload);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scan-runs"] });
    },
  });
}

// ─── Admin — Overview ───────────────────────────────────────

/**
 * Single round-trip for every headline card on the admin Overview
 * (movies / series / users counts, review queue length, last
 * scan snapshot, HLS cache occupancy). Replaces five individual
 * queries so the dashboard cards settle in one loading
 * transition rather than flickering through each separately.
 */
export function useAdminOverviewStats() {
  return useQuery({
    queryKey: ["admin", "overview-stats"],
    queryFn: async (): Promise<AdminOverviewStats> => {
      const resp = await api.get<AdminOverviewStatsResponse>("/admin/overview/stats");
      return resp.data;
    },
    // Cheap aggregate read — keep it fresh-ish without
    // hammering the backend on every focus change.
    staleTime: 30_000,
  });
}

// ─── Notifications ──────────────────────────────────────────

/**
 * Polling interval for the header bell. 30 s matches the cadence
 * of ``useHealth`` / ``useReadiness`` — frequent enough that an
 * arrival ping (catalog request fulfilled) lands in the badge
 * within half a minute of the backend handler firing, infrequent
 * enough that the inbox never dominates the request log.
 */
const NOTIFICATIONS_POLL_MS = 30_000;

/**
 * Default page size for the dropdown. Bigger than what the
 * dropdown ever shows so a small inbox renders end-to-end without
 * a "Load more" affordance; smaller than 200 (the backend cap) so
 * a runaway user (hundreds of notifications) doesn't ship the
 * full history on every poll.
 */
const NOTIFICATIONS_PAGE_LIMIT = 50;

export interface NotificationsListResult {
  items: Notification[];
  unreadCount: number;
}

/**
 * Fetch the caller's notifications inbox + unread badge count.
 *
 * Polled at ``NOTIFICATIONS_POLL_MS`` so the bell stays roughly
 * live without a websocket. The ``unread_count`` in the response
 * metadata is the canonical source for the badge — never derived
 * from ``items`` (the dropdown may be filtered or capped, but the
 * badge must reflect the household-wide total).
 */
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<NotificationsListResult> => {
      const resp = await api.get<NotificationsResponse>("/notifications", {
        limit: String(NOTIFICATIONS_PAGE_LIMIT),
      });
      return {
        items: resp.data,
        unreadCount: resp.metadata.unread_count ?? 0,
      };
    },
    refetchInterval: NOTIFICATIONS_POLL_MS,
  });
}

/**
 * Mark a single notification read.
 *
 * The backend is idempotent — re-marking an already-read row
 * returns the existing state without a DB write — so the
 * frontend never has to guard against double-clicks. Invalidates
 * the inbox query so both the dropdown row and the badge update
 * after the round-trip lands.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string): Promise<Notification> => {
      const resp = await api.patch<NotificationResponse>(
        `/notifications/${notificationId}/read`,
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      notifyOtherTabs();
    },
  });
}

/**
 * Bulk-clear the caller's unread inbox in one round-trip.
 *
 * The backend performs a single bulk ``UPDATE`` so a long-
 * untouched inbox flips without an N+1 fetch. Idempotent —
 * calling on an already-clean inbox returns ``marked_read=0``
 * without a DB write, so the caller never has to branch on the
 * empty case. Same cache-invalidation flow as
 * ``useMarkNotificationRead``: ``["notifications"]`` is dropped
 * on success so the badge + dropdown reconcile on the next
 * refetch.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<MarkAllNotificationsReadPayload> => {
      const resp = await api.post<MarkAllNotificationsReadResponse>(
        "/notifications/read-all",
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      notifyOtherTabs();
    },
  });
}
