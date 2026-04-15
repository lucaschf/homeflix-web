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
  trailer_url: string | null;
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
  progress_percentage: number | null;
  position_seconds: number | null;
  watch_status: string | null;
  last_watched_at: string | null;
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
  content_rating: string | null;
  trailer_url: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  season_count: number;
  total_episodes: number;
  seasons: SeasonOutput[];
  created_at: string;
  updated_at: string;
}

// Cursor pagination metadata returned by paginated list endpoints.
// `next_cursor` is an opaque string the client passes back as `?cursor=`
// to fetch the next page; `null` means there are no more pages.
export interface PaginationMetadata {
  next_cursor: string | null;
  has_more: boolean;
}

// API wraps responses in { type, data, metadata }. Both `pagination` and
// `total_count` are optional: pagination is only present on paginated
// endpoints, and total_count is opt-in via `?include_count=true` because
// the COUNT(*) is the most expensive part of a list query and infinite-
// scroll consumers don't need it.
export interface ApiListResponse<T> {
  type: string;
  data: T[];
  metadata: {
    pagination?: PaginationMetadata;
    total_count?: number;
  };
}

export interface ApiDetailResponse<T> {
  type: string;
  data: T;
}

export type ListMoviesResponse = ApiListResponse<MovieSummary>;
export type ListSeriesResponse = ApiListResponse<SeriesSummary>;
export type MovieDetailResponse = ApiDetailResponse<MovieDetail>;
export type SeriesDetailResponse = ApiDetailResponse<SeriesDetail>;

// One row in the catalog genres listing returned by /api/v1/catalog/genres.
// `id` is the canonical English genre name (used as the filter key for the
// by-genre endpoint, stable across UI language changes); `name` is the
// localized display label, falling back to the canonical name when no
// translation exists.
export interface Genre {
  id: string;
  name: string;
  count: number;
}

export type GenresResponse = ApiListResponse<Genre>;

// One row in the catalog by-genre listing — discriminated union of movie
// and series via the `type` field. The shape carries the same fields the
// existing card components already render so a single MediaCard variant
// can handle both.
export interface CatalogItem {
  id: string;
  type: "movie" | "series";
  title: string;
  year: number;
  synopsis: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string[];
}

export type CatalogByGenreResponse = ApiListResponse<CatalogItem>;

// Search endpoint response — same item shape as the catalog but with
// a `total` count in metadata instead of pagination cursors.
export interface SearchResponse {
  type: string;
  data: CatalogItem[];
  metadata: { total: number };
}

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
  series_id: string | null;
  series_title: string | null;
  season_number: number | null;
  episode_number: number | null;
}

export interface ProgressResponse {
  type: string;
  data: ProgressOutput | null;
}

export interface ContinueWatchingResponse {
  type: string;
  data: ContinueWatchingItem[];
}

// Watchlist
export interface WatchlistItemOutput {
  media_id: string;
  media_type: "movie" | "series";
  title: string;
  poster_path: string | null;
  added_at: string;
}

export interface ToggleWatchlistResponse {
  type: string;
  data: { media_id: string; added: boolean };
}

export interface WatchlistResponse {
  type: string;
  data: WatchlistItemOutput[];
}

export interface CheckWatchlistResponse {
  type: string;
  data: { in_list: boolean };
}

// Custom Lists
export interface CustomListOutput {
  id: string;
  name: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface CustomListItemOutput {
  media_id: string;
  media_type: "movie" | "series";
  title: string;
  poster_path: string | null;
  position: number;
  added_at: string;
}

export interface CustomListsResponse {
  type: string;
  data: CustomListOutput[];
}

export interface CustomListDetailResponse {
  type: string;
  data: CustomListOutput;
}

export interface CustomListItemsResponse {
  type: string;
  data: CustomListItemOutput[];
}

export interface AddItemToCustomListResponse {
  type: string;
  data: { list_id: string; media_id: string; added: boolean };
}

// Featured
export interface FeaturedItem {
  id: string;
  type: "movie" | "series";
  title: string;
  synopsis: string | null;
  year: number;
  duration_formatted: string | null;
  genres: string[];
  backdrop_path: string | null;
  content_rating: string | null;
  trailer_url: string | null;
}

export interface FeaturedResponse {
  type: string;
  data: FeaturedItem[];
}

// ── Library ─────────────────────────────────────────────

export interface LibraryMetadataProvider {
  provider: string;
  priority: number;
  enabled: boolean;
}

export interface LibrarySettings {
  preferred_audio_language: string;
  preferred_subtitle_language: string | null;
  subtitle_mode: string;
  generate_thumbnails: boolean;
  detect_intros: boolean;
  auto_refresh_metadata: boolean;
}

export interface Library {
  id: string;
  name: string;
  library_type: string;
  paths: string[];
  language: string;
  metadata_providers: LibraryMetadataProvider[];
  scan_schedule: string | null;
  last_scan_at: string | null;
  settings: LibrarySettings;
}

export interface LibraryResponse {
  data: Library;
}

export interface LibrariesResponse {
  type: string;
  data: Library[];
}

// ── Preferences ─────────────────────────────────────────

export interface PlaybackPreferencesData {
  audio_lang: string;
  subtitle_lang: string;
  subtitle_mode: string;
  default_quality: string;
  speed: number;
}

export interface PreferencesResponse {
  data: PlaybackPreferencesData;
}
