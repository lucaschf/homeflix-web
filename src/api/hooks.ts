import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "./client";
import type {
  BulkEnrichResponse,
  ContinueWatchingItem,
  ContinueWatchingResponse,
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
} from "./types";

// ── Queries ──────────────────────────────────────────────

export function useMovies() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ["movies", lang],
    queryFn: async (): Promise<{ movies: MovieSummary[]; total_count: number }> => {
      const resp = await api.get<ListMoviesResponse>("/movies", { lang });
      return { movies: resp.data, total_count: resp.metadata.total_count };
    },
  });
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
  return useQuery({
    queryKey: ["series", lang],
    queryFn: async (): Promise<{ series: SeriesSummary[]; total_count: number }> => {
      const resp = await api.get<ListSeriesResponse>("/series", { lang });
      return { series: resp.data, total_count: resp.metadata.total_count };
    },
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
