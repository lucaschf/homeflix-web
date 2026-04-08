// API response types matching backend DTOs

export interface MovieSummary {
  id: string;
  title: string;
  year: number;
  duration_formatted: string;
  synopsis: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  resolution: string | null;
  variant_count: number;
  available_resolutions: string[];
  genres: string[];
}

export interface MediaFileOutput {
  file_path: string;
  file_size: number;
  resolution: string;
  video_codec: string | null;
  video_bitrate: number | null;
  hdr_format: string | null;
  is_primary: boolean;
}

export interface MovieDetail {
  id: string;
  title: string;
  original_title: string | null;
  year: number;
  duration_seconds: number;
  duration_formatted: string;
  synopsis: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string[];
  cast: string[];
  directors: string[];
  writers: string[];
  content_rating: string | null;
  file_path: string | null;
  file_size: number | null;
  resolution: string | null;
  files: MediaFileOutput[];
  tmdb_id: number | null;
  imdb_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeOutput {
  id: string | null;
  episode_number: number;
  title: string;
  synopsis: string | null;
  duration_seconds: number;
  duration_formatted: string;
  file_path: string | null;
  file_size: number | null;
  resolution: string | null;
  files: MediaFileOutput[];
  thumbnail_path: string | null;
  air_date: string | null;
}

export interface SeasonOutput {
  id: string | null;
  season_number: number;
  title: string | null;
  synopsis: string | null;
  poster_path: string | null;
  air_date: string | null;
  episode_count: number;
  episodes: EpisodeOutput[];
}

export interface SeriesSummary {
  id: string;
  title: string;
  start_year: number;
  end_year: number | null;
  is_ongoing: boolean;
  synopsis: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  season_count: number;
  total_episodes: number;
  genres: string[];
}

export interface SeriesDetail {
  id: string;
  title: string;
  original_title: string | null;
  start_year: number;
  end_year: number | null;
  is_ongoing: boolean;
  synopsis: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string[];
  tmdb_id: number | null;
  imdb_id: string | null;
  season_count: number;
  total_episodes: number;
  seasons: SeasonOutput[];
  created_at: string;
  updated_at: string;
}

// API wraps responses in { type, data, metadata }
export interface ApiListResponse<T> {
  type: string;
  data: T[];
  metadata: { total_count: number };
}

export interface ApiDetailResponse<T> {
  type: string;
  data: T;
}

export type ListMoviesResponse = ApiListResponse<MovieSummary>;
export type ListSeriesResponse = ApiListResponse<SeriesSummary>;
export type MovieDetailResponse = ApiDetailResponse<MovieDetail>;
export type SeriesDetailResponse = ApiDetailResponse<SeriesDetail>;

export interface ScanResponse {
  movies_created: number;
  movies_updated: number;
  episodes_created: number;
  episodes_updated: number;
  errors: string[];
}

export interface EnrichResponse {
  media_id: string;
  enriched: boolean;
  provider: string | null;
  error: string | null;
}

export interface BulkEnrichResponse {
  movies_enriched: number;
  series_enriched: number;
  skipped: number;
  errors: string[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

// Watch Progress
export type MediaType = "movie" | "episode";
export type WatchStatus = "in_progress" | "completed";

export interface ProgressOutput {
  media_id: string;
  media_type: MediaType;
  position_seconds: number;
  duration_seconds: number;
  percentage: number;
  status: WatchStatus;
  audio_track: number | null;
  subtitle_track: number | null;
  last_watched_at: string;
}

export interface ContinueWatchingItem {
  media_id: string;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  position_seconds: number;
  duration_seconds: number;
  percentage: number;
  last_watched_at: string;
}

export interface ProgressResponse {
  type: string;
  data: ProgressOutput | null;
}

export interface ContinueWatchingResponse {
  type: string;
  data: ContinueWatchingItem[];
}
