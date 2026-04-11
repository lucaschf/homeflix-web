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
  BulkEnrichResponse,
  FeaturedItem,
  FeaturedResponse,
  CheckWatchlistResponse,
  ContinueWatchingItem,
  ContinueWatchingResponse,
  CustomListDetailResponse,
  CustomListItemOutput,
  CustomListItemsResponse,
  CustomListOutput,
  CustomListsResponse,
  EnrichResponse,
  HealthResponse,
  ListMoviesResponse,
  ListSeriesResponse,
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

// Page size used by both useMovies and useSeries. Matches the backend
// `DEFAULT_PAGE_SIZE` (20) — kept in sync manually because the constant
// can't cross the network boundary at the type level. PR2 will switch
// each consumer to a hook-specific size where it makes sense, but for
// the foundation PR we use a single value everywhere.
const LIST_PAGE_SIZE = 20;

// Eagerly fetches every page on mount until there are no more. The
// Home and Browse pages still need every movie / series in memory at
// once because they group items into genre carousels client-side; PR2
// of the cursor-pagination work introduces per-genre endpoints and
// switches the consumers to incremental rendering. Until then this
// hook reproduces the previous "fetch the whole catalogue" behavior on
// top of the new paginated endpoints.
export function useMovies() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useInfiniteQuery({
    queryKey: ["movies", lang],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = {
        lang,
        limit: String(LIST_PAGE_SIZE),
      };
      if (pageParam) params.cursor = pageParam;
      return api.get<ListMoviesResponse>("/movies", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  // Destructure the query fields the effect closes over so the
  // exhaustive-deps lint can verify their stability — listing the
  // whole `query` object as a dep would re-run the effect on every
  // render and trigger an infinite loop.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Auto-advance through every page until the cursor is exhausted.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const movies = useMemo<MovieSummary[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  // Treat the listing as "loading" while any page is still in flight,
  // so consumers don't see the carousels half-built and re-grouping
  // every render — matches the pre-pagination single-shot UX.
  const isLoading = query.isLoading || isFetchingNextPage || hasNextPage;

  return { data: { movies }, isLoading };
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

// Mirror of `useMovies` for the series listing — see the comment over
// there for why we eagerly fetch every page on mount in PR1.
export function useSeries() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useInfiniteQuery({
    queryKey: ["series", lang],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params: Record<string, string> = {
        lang,
        limit: String(LIST_PAGE_SIZE),
      };
      if (pageParam) params.cursor = pageParam;
      return api.get<ListSeriesResponse>("/series", params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.metadata.pagination?.next_cursor ?? null,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const series = useMemo<SeriesSummary[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  const isLoading = query.isLoading || isFetchingNextPage || hasNextPage;

  return { data: { series }, isLoading };
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

export function useIsInWatchlist(mediaId: string) {
  return useQuery({
    queryKey: ["watchlist", "check", mediaId],
    queryFn: async (): Promise<boolean> => {
      const resp = await api.get<CheckWatchlistResponse>(`/watchlist/check/${mediaId}`);
      return resp.data.in_list;
    },
    enabled: !!mediaId,
  });
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { media_id: string; media_type: string }) =>
      api.post<ToggleWatchlistResponse>("/watchlist/toggle", data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "check", vars.media_id] });
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
