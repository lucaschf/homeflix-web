import { useEffect, useMemo } from "react";
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
  ApiListResponse,
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
  MovieDetail,
  MovieDetailResponse,
  MovieSummary,
  ProgressOutput,
  ProgressResponse,
  ScanResponse,
  SeriesDetail,
  SeriesDetailResponse,
  SeriesSummary,
  ToggleWatchlistResponse,
  WatchlistItemOutput,
  WatchlistResponse,
} from "./types";

// ── Queries ──────────────────────────────────────────────

// Default page size for the eagerly-loaded list hooks. The frontend
// passes this value explicitly on every request, so it does NOT have
// to match the backend's `DEFAULT_PAGE_SIZE` — the two are
// independent. Lives next to the only helper that consumes it so
// there's exactly one place to change.
const EAGER_LIST_PAGE_SIZE = 20;

/**
 * Eagerly walks every page of a cursor-paginated list endpoint and
 * returns the flattened items plus a single `isLoading` flag that
 * stays `true` until the entire catalog is in memory.
 *
 * Used by both `useMovies` and `useSeries` (and, in PR2, by the
 * per-genre carousels) to back the genre-grouping the Home and Browse
 * pages still do client-side. Once PR2 lands its per-carousel
 * endpoints the eager-walk goes away and consumers switch to the
 * incremental `fetchNextPage` API directly — at that point this
 * helper will lose the auto-advance effect but keep the same shape.
 */
function useEagerInfiniteList<T>(
  queryKey: readonly unknown[],
  endpoint: string,
  baseParams: Record<string, string>,
): { items: T[]; isLoading: boolean } {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = {
        ...baseParams,
        limit: String(EAGER_LIST_PAGE_SIZE),
      };
      if (pageParam) params.cursor = pageParam;
      return api.get<ApiListResponse<T>>(endpoint, params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  // Destructure the fields the effect closes over so the
  // exhaustive-deps lint can verify their stability — passing the
  // whole `query` object as a dep would re-run the effect every
  // render and infinite-loop.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Auto-advance through every page until the cursor is exhausted.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = useMemo<T[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  // Treat the listing as "loading" while any page is still in flight,
  // so consumers don't see the carousels half-built and re-grouping
  // every render — matches the pre-pagination single-shot UX.
  const isLoading = query.isLoading || isFetchingNextPage || hasNextPage;

  return { items, isLoading };
}

export function useMovies() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const { items, isLoading } = useEagerInfiniteList<MovieSummary>(
    ["movies", lang],
    "/movies",
    { lang },
  );
  return { data: { movies: items }, isLoading };
}

// ── Catalog (per-genre) ─────────────────────────────────

// Page size for the by-genre infinite query. Independent of the
// backend default — frontend always passes this explicitly. Picked
// to fill ~2-3 viewport widths of a horizontal carousel on a wide
// desktop, with enough buffer that the user rarely sees a loading
// spinner mid-scroll.
const BY_GENRE_PAGE_SIZE = 20;

/**
 * Single fetch of every genre present in the library, with counts
 * and localized display names. The Home and Browse pages use the
 * result to lay out one carousel per genre and to know which genres
 * exist before mounting any per-genre infinite query.
 */
export function useGenres() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["catalog", "genres", lang],
    queryFn: async (): Promise<Genre[]> => {
      const resp = await api.get<GenresResponse>("/catalog/genres", { lang });
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
 */
export function useByGenre(genreId: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useInfiniteQuery({
    queryKey: ["catalog", "by-genre", genreId, lang],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = {
        lang,
        limit: String(BY_GENRE_PAGE_SIZE),
      };
      if (pageParam) params.cursor = pageParam;
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

export function useSeries() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const { items, isLoading } = useEagerInfiniteList<SeriesSummary>(
    ["series", lang],
    "/series",
    { lang },
  );
  return { data: { series: items }, isLoading };
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
