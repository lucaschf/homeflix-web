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
  BulkEnrichResponse,
  CatalogByGenreResponse,
  CatalogItem,
  ContinueWatchingItem,
  ContinueWatchingResponse,
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
  LibrariesResponse,
  Library,
  LibraryResponse,
  PlaybackPreferencesData,
  PreferencesResponse,
  MovieDetail,
  MovieDetailResponse,
  MovieSummary,
  MoviesByActorResponse,
  PersonBio,
  PersonBioResponse,
  RelatedMoviesResponse,
  ProgressOutput,
  ProgressResponse,
  ScanResponse,
  SearchResponse,
  SeriesDetail,
  SeriesDetailResponse,
  ToggleWatchlistResponse,
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
export function useRelatedMovies(movieId: string, limit = 12) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["related-movies", movieId, lang, limit],
    queryFn: async (): Promise<MovieSummary[]> => {
      const resp = await api.get<RelatedMoviesResponse>(`/movies/${movieId}/related`, {
        lang,
        limit: String(limit),
      });
      return resp.data;
    },
    enabled: !!movieId,
  });
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

export function useScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (directories?: string[]) =>
      api.post<ScanResponse>("/scan", directories?.length ? { directories } : undefined),
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
    mutationFn: (force = false) => api.post<BulkEnrichResponse>("/enrich", { force }),
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

export function useCreateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      library_type: string;
      paths: string[];
      language?: string;
      scan_schedule?: string | null;
    }) => api.post<LibraryResponse>("/libraries", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
    },
  });
}

export function useUpdateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      body: {
        name?: string;
        library_type?: string;
        paths?: string[];
        language?: string;
        scan_schedule?: string | null;
      };
    }) => api.put<LibraryResponse>(`/libraries/${vars.id}`, vars.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
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
