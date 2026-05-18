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
  // Operator-facing metadata surfaced on the admin Catalog table.
  // User-facing cards ignore them.
  library_id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  needs_enrichment_review: boolean;
}

export interface AudioTrackOutput {
  index: number;
  language: string;
  codec: string;
  channels: number;
  channel_layout: string;
  title: string | null;
  is_default: boolean;
}

export interface SubtitleTrackOutput {
  index: number;
  language: string;
  format: string;
  title: string | null;
  is_default: boolean;
  is_forced: boolean;
  is_external: boolean;
}

export interface MediaFileOutput {
  file_path: string;
  file_size: number;
  resolution: string;
  video_codec: string | null;
  video_bitrate: number | null;
  hdr_format: string | null;
  is_primary: boolean;
  audio_tracks: AudioTrackOutput[];
  subtitle_tracks: SubtitleTrackOutput[];
}

export interface CastMemberOutput {
  /** Actor's display name. */
  name: string;
  /** Full URL to the TMDB profile photo, or ``null`` for fallback initials. */
  profile_path: string | null;
  /** Character name played, or ``null`` when not provided. */
  role: string | null;
  /**
   * TMDB person id, or ``null`` for rows enriched before the id was
   * captured. The actor page uses this to fetch biography from
   * ``/api/v1/people/:id``; absence keeps a name-only header.
   */
  tmdb_id: number | null;
}

export interface PersonBio {
  tmdb_id: number;
  name: string;
  /** Long-form biography. May be an empty string when TMDB has none. */
  biography: string;
  /** ISO date or ``null``. */
  birthday: string | null;
  /** ISO date or ``null``. */
  deathday: string | null;
  place_of_birth: string | null;
  /** Primary department on TMDB (e.g. ``"Acting"``), or ``null``. */
  known_for_department: string | null;
  /** Full URL to the profile photo, or ``null``. */
  profile_path: string | null;
}

export interface PersonBioResponse {
  type: string;
  data: PersonBio;
}

export interface CollectionOutput {
  tmdb_id: number;
  name: string;
  parts_count: number;
}

/** Single member title of a TMDB collection, merged with local + request state. */
export interface CollectionPart {
  tmdb_id: number;
  title: string;
  year: number | null;
  synopsis: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  rating: number | null;
  runtime_seconds: number | null;
  runtime_formatted: string | null;
  in_catalog: boolean;
  movie_id: string | null;
  local_poster_path: string | null;
  local_backdrop_path: string | null;
  is_requested: boolean;
  notify_on_arrival: boolean;
}

/** Full Collection Detail payload. */
export interface CollectionDetail {
  tmdb_id: number;
  name: string;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  total_parts: number;
  available_parts: number;
  missing_parts: number;
  parts: CollectionPart[];
}

export type CollectionDetailResponse = ApiDetailResponse<CollectionDetail>;

/** Catalog request shape returned by /catalog-requests endpoints. */
export interface CatalogRequest {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "series";
  collection_tmdb_id: number | null;
  notify_on_arrival: boolean;
  is_fulfilled: boolean;
  requested_at: string;
  fulfilled_at: string | null;
}

export type CatalogRequestResponse = ApiDetailResponse<CatalogRequest>;
export type CatalogRequestsResponse = ApiListResponse<CatalogRequest>;

export interface MovieDetail {
  id: string;
  title: string;
  original_title: string | null;
  year: number;
  duration_seconds: number;
  duration_formatted: string;
  synopsis: string | null;
  tagline: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  logo_path: string | null;
  genres: string[];
  cast: CastMemberOutput[];
  directors: string[];
  writers: string[];
  content_rating: string | null;
  trailer_url: string | null;
  collection: CollectionOutput | null;
  file_path: string | null;
  file_size: number | null;
  resolution: string | null;
  files: MediaFileOutput[];
  tmdb_id: number | null;
  imdb_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntroMarkerOutput {
  start_seconds: number;
  end_seconds: number;
  source: "AUTO_DETECTED" | "MANUAL";
  confidence: number | null;
  detected_at: string;
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
  scrub_preview_path: string | null;
  air_date: string | null;
  intro: IntroMarkerOutput | null;
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
  // Operator-facing metadata surfaced on the admin Catalog table.
  library_id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
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
  logo_path: string | null;
  genres: string[];
  content_rating: string | null;
  trailer_url: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  season_count: number;
  total_episodes: number;
  seasons: SeasonOutput[];
  // Optional because older backend builds don't return the field;
  // consumers normalize via ``cast ?? []`` until those are gone.
  cast?: CastMemberOutput[];
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
export type MoviesByActorResponse = ApiListResponse<MovieSummary>;
export type ListSeriesResponse = ApiListResponse<SeriesSummary>;
export type MovieDetailResponse = ApiDetailResponse<MovieDetail>;
export type SeriesDetailResponse = ApiDetailResponse<SeriesDetail>;
export type RelatedMoviesResponse = ApiListResponse<MovieSummary>;
export type RelatedSeriesResponse = ApiListResponse<SeriesSummary>;
export type RecentlyAddedMoviesResponse = ApiListResponse<MovieSummary>;
export type RecentlyAddedSeriesResponse = ApiListResponse<SeriesSummary>;
export type RecentlyAddedCatalogResponse = ApiListResponse<CatalogItem>;

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

/**
 * ``GET /health/ready`` payload. Distinct from the bare ``/health``
 * endpoint: the ready check enumerates each backing dependency
 * (currently database + filesystem; future TMDB / scheduler / disk
 * pressure live here once the backend grows real probes) so the
 * admin Overview can render per-component status pills instead of
 * a single overall light.
 */
export interface ReadinessResponse {
  /** ``"ready"`` when every check is healthy, else ``"not_ready"``. */
  status: string;
  timestamp: string;
  checks: Record<string, string>;
}

/**
 * ``GET /api/v1/admin/hls-cache`` payload. The admin System page
 * renders ``size_bytes`` over ``max_bytes`` as an occupancy bar
 * and shows ``last_cleared_at`` as the freshness signal for the
 * "Clear cache" button.
 */
export interface HlsCacheStats {
  size_bytes: number;
  max_bytes: number;
  last_cleared_at: string | null;
}

export type HlsCacheStatsResponse = ApiDetailResponse<HlsCacheStats>;

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
  logo_path: string | null;
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
  // Optional so the UI degrades gracefully if the client talks to an
  // older backend that predates the counts fields.
  movie_count?: number;
  series_count?: number;
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

// ── Identity (auth + profiles) ──────────────────────────
//
// IDs are prefixed external strings (e.g. ``usr_xxx``, ``prf_xxx``,
// ``lib_xxx``) per ADR-002. The frontend never sees database UUIDs.

export interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  // Prefixed external id (``prf_xxx``) of the profile currently bound
  // to this session, sourced from the backend's
  // ``access_tokens.current_profile_id``. ``null`` between login and
  // the first ``POST /profiles/{id}/switch`` — every consumer that
  // renders profile-scoped UI (navbar avatar chip, "active profile"
  // marker, etc.) reads this and skips its branch when null.
  active_profile_id: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_kids: boolean;
  // Default-deny: empty list means the profile may not see any
  // library. Backfilled to a snapshot of every active library at
  // PR #176 migration time, so legacy households keep their
  // pre-ACL "see everything" behavior. Future grants/revokes go
  // through ``PUT /api/v1/profiles/{id}``.
  allowed_library_ids: string[];
  created_at: string;
  updated_at: string;
}

export type UserResponse = ApiDetailResponse<User>;
export type ProfileResponse = ApiDetailResponse<Profile>;
export type ProfilesResponse = ApiListResponse<Profile>;

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  is_kids?: boolean;
  avatar_url?: string | null;
  // ``null`` means "leave the ACL alone" (PATCH-style); an explicit
  // ``[]`` revokes every library; a list replaces.
  allowed_library_ids?: string[] | null;
}

export interface CreateProfileInput {
  name: string;
  is_kids?: boolean;
  avatar_url?: string | null;
  // Default-deny on the backend when omitted. Pass an explicit list
  // to grant access at creation time.
  allowed_library_ids?: string[] | null;
}

// =============================================================================
// Admin — Movie Relink (TMDB review queue)
// =============================================================================

// One row on the admin "needs review" listing. Backend sets the
// underlying flag when an enrichment attempt couldn't resolve a
// TMDB match (off-year title, cross-type miss). Slim by design —
// these movies have no poster/synopsis to render in the card view.
export interface NeedsReviewMovie {
  id: string;
  title: string;
  year: number;
  file_path: string | null;
}

// One candidate card shown in the suggestion picker. Both movie
// and TV candidates share this shape; `media_type` selects which
// section it lives in and which `media_type` value to send back
// on relink.
export interface TmdbSuggestion {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  year: number | null;
  overview: string | null;
  poster_url: string | null;
}

export interface TmdbSuggestionsPayload {
  movie_id: string;
  movies: TmdbSuggestion[];
  series: TmdbSuggestion[];
}

export interface RelinkMovieInput {
  tmdb_id: number;
  // Backend enforces this at the schema layer — TV picks route
  // through ``promoteMovieToSeries`` instead. Keeping the literal
  // here so misuse is caught at the call site (TypeScript) rather
  // than as a 422 response surprise.
  media_type: "movie";
}

export interface RelinkMoviePayload {
  movie_id: string;
  enriched: boolean;
  provider: string | null;
  error: string | null;
}

export type NeedsReviewMoviesResponse = ApiListResponse<NeedsReviewMovie>;
export type TmdbSuggestionsResponse = ApiDetailResponse<TmdbSuggestionsPayload>;
export type RelinkMovieResponse = ApiDetailResponse<RelinkMoviePayload>;

// Cross-type conversion: an admin picked a TV card in the suggestion
// picker, confirming that the misclassified movie row should be
// replaced by a Series. Backend builds Series + Season + Episodes,
// migrates the file variants onto E01, soft-deletes the movie, and
// fans the change out to watch_progress + collections.
export interface PromoteMovieToSeriesInput {
  tmdb_id: number;
}

export interface PromoteMovieToSeriesPayload {
  movie_id: string;
  series_id: string;
  first_episode_id: string;
  episodes_created: number;
}

export type PromoteMovieToSeriesResponse = ApiDetailResponse<PromoteMovieToSeriesPayload>;
