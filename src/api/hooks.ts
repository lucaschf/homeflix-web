import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  BulkEnrichResponse,
  EnrichResponse,
  HealthResponse,
  ListMoviesResponse,
  ListSeriesResponse,
  MovieDetail,
  MovieDetailResponse,
  MovieSummary,
  ScanResponse,
  SeriesDetail,
  SeriesDetailResponse,
  SeriesSummary,
} from "./types";

// ── Queries ──────────────────────────────────────────────

export function useMovies() {
  return useQuery({
    queryKey: ["movies"],
    queryFn: async (): Promise<{ movies: MovieSummary[]; total_count: number }> => {
      const resp = await api.get<ListMoviesResponse>("/movies");
      return { movies: resp.data, total_count: resp.metadata.total_count };
    },
  });
}

export function useMovie(movieId: string) {
  return useQuery({
    queryKey: ["movie", movieId],
    queryFn: async (): Promise<MovieDetail> => {
      const resp = await api.get<MovieDetailResponse>(`/movies/${movieId}`);
      return resp.data;
    },
    enabled: !!movieId,
  });
}

export function useSeries() {
  return useQuery({
    queryKey: ["series"],
    queryFn: async (): Promise<{ series: SeriesSummary[]; total_count: number }> => {
      const resp = await api.get<ListSeriesResponse>("/series");
      return { series: resp.data, total_count: resp.metadata.total_count };
    },
  });
}

export function useSeriesDetail(seriesId: string) {
  return useQuery({
    queryKey: ["series", seriesId],
    queryFn: async (): Promise<SeriesDetail> => {
      const resp = await api.get<SeriesDetailResponse>(`/series/${seriesId}`);
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
