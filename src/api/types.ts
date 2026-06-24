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

/**
 * Structured differentiator for tracks that share a language, returned
 * by the ``/tracks`` endpoint. ``studio`` / ``channel_layout`` carry a
 * ready-to-show value; ``ordinal`` and ``sdh`` are localized client-side.
 */
export interface FileTrackVersion {
  kind: "studio" | "channel_layout" | "ordinal" | "sdh";
  value: string;
}

/** One audio track from the per-file ``/tracks`` endpoint. */
export interface FileAudioTrack {
  index: number;
  language: string;
  codec: string;
  channels: number;
  channel_layout: string;
  title: string | null;
  version: FileTrackVersion | null;
  is_default: boolean;
}

/** One subtitle track from the per-file ``/tracks`` endpoint. */
export interface FileSubtitleTrack {
  index: number;
  language: string;
  format: string;
  title: string | null;
  version: FileTrackVersion | null;
  is_default: boolean;
  is_forced: boolean;
  is_external: boolean;
  is_image_based: boolean;
}

/**
 * Response of ``GET /stream/{movie|episode}/.../tracks``. Returned raw
 * (not wrapped in the ``{data}`` envelope), so consume it directly.
 */
export interface FileTracks {
  audio_tracks: FileAudioTrack[];
  subtitle_tracks: FileSubtitleTrack[];
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
export type CatalogRequestSource = "user" | "household";
export type CatalogRequestStatus = "pending" | "fulfilled";

export interface CatalogRequest {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "series";
  /** Snapshot of the title taken at request time. ``null`` on rows
   *  created before the backend stored the title. */
  title: string | null;
  /** External id of the user who first registered it; ``null`` on
   *  legacy / household-seeded rows. */
  requester_user_id: string | null;
  collection_tmdb_id: number | null;
  /** Where it came from: a member request vs. a household/system seed. */
  source: CatalogRequestSource;
  notify_on_arrival: boolean;
  is_fulfilled: boolean;
  /** Honest, derived status (pending vs. fulfilled). */
  status: CatalogRequestStatus;
  requested_at: string;
  fulfilled_at: string | null;
  /** Active subscriber count — present on the admin queue + member
   *  feed list responses; absent on single-request responses. */
  subscriber_count?: number;
  /** Whether the calling user follows the title — member feed only. */
  is_subscribed?: boolean;
}

export type CatalogRequestResponse = ApiDetailResponse<CatalogRequest>;
export type CatalogRequestsResponse = ApiListResponse<CatalogRequest>;

/**
 * Which detection branch the backend's lookup parser took.
 * ``tmdb_id`` and ``imdb_id`` are direct-id resolutions (≤ 2 hits);
 * ``text`` is the free-text search branch.
 */
export type CatalogLookupKind = "tmdb_id" | "imdb_id" | "text";

/**
 * One picker row in the "Request a title" dialog. Mirrors the
 * backend ``TmdbLookupCandidate`` DTO 1:1.
 */
export interface CatalogLookupCandidate {
  tmdb_id: number;
  /** ``"movie"`` (``/movie/{id}``) or ``"tv"`` (``/tv/{id}``). The
   *  request POST takes ``"movie"`` / ``"series"`` — the dialog maps
   *  ``"tv"`` → ``"series"`` at submit time. */
  media_type: "movie" | "tv";
  title: string;
  year: number | null;
  overview: string | null;
  poster_url: string | null;
}

export interface CatalogLookupResult {
  /** Echo of the cleaned query (empty when input was whitespace). */
  query: string;
  kind: CatalogLookupKind;
  candidates: CatalogLookupCandidate[];
}

export type CatalogLookupResponse = ApiDetailResponse<CatalogLookupResult>;

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
  needs_enrichment_review: boolean;
  created_at: string;
  updated_at: string;
  credits: CreditsMarkerOutput | null;
}

export interface IntroMarkerOutput {
  start_seconds: number;
  end_seconds: number;
  source: "AUTO_DETECTED" | "MANUAL";
  confidence: number | null;
  detected_at: string;
}

/** End-credits onset marker (credits run to the file end, so start only). */
export interface CreditsMarkerOutput {
  start_seconds: number;
  source: "AUTO_DETECTED" | "MANUAL";
  confidence: number | null;
  detected_at: string;
}

/** One title's credits-detection status (admin observability). */
export interface CreditsStatusItem {
  media_id: string;
  media_type: "movie" | "episode";
  title: string;
  state: string;
  start_seconds: number | null;
  source: "AUTO_DETECTED" | "MANUAL" | null;
  confidence: number | null;
  /** Episode context for deep-linking the editor; null for movies. */
  series_id: string | null;
  season_number: number | null;
  episode_number: number | null;
}

/** A page of credits-status rows + the unfiltered per-state counts. */
export interface CreditsStatusData {
  items: CreditsStatusItem[];
  total: number;
  counts: Record<string, number>;
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
  credits: CreditsMarkerOutput | null;
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
  // Episodes with an intro marker set (auto or manual). Drives the
  // per-series "skip intro" coverage shown in the admin intro picker.
  intro_marked_count: number;
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
  needs_enrichment_review: boolean;
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

/**
 * Lightweight admin user row returned by ``GET /api/v1/admin/users``.
 * Profile count is precomputed server-side so the list page can
 * render the multi-profile hint without a second round-trip.
 */
export interface AdminUserSummary {
  id: string;
  email: string;
  role: "admin" | "member";
  is_active: boolean;
  profile_count: number;
  created_at: string;
}

export type AdminUsersResponse = ApiListResponse<AdminUserSummary>;
export type AdminUserSummaryResponse = ApiDetailResponse<AdminUserSummary>;

/**
 * Profile payload nested inside the admin user-detail response.
 * Mirrors the user-facing profile shape — admin views it
 * read-only in P3 (profile CRUD for other users stays out of
 * scope until a follow-up).
 */
export interface AdminProfileSummary {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_kids: boolean;
  allowed_library_ids: string[];
  created_at: string;
  updated_at: string;
}

/**
 * ``GET /api/v1/admin/users/{user_id}`` payload. The detail page
 * renders the Account panel (email, role, delete) on the left
 * and the read-only Profiles list on the right.
 */
export interface AdminUserDetail {
  id: string;
  email: string;
  role: "admin" | "member";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profiles: AdminProfileSummary[];
}

export type AdminUserDetailResponse = ApiDetailResponse<AdminUserDetail>;

/** Body for ``POST /api/v1/admin/users``. */
export interface CreateAdminUserPayload {
  email: string;
  password: string;
  role: "admin" | "member";
}

/** Body for ``PATCH /api/v1/admin/users/{user_id}``. */
export interface UpdateUserRolePayload {
  role: "admin" | "member";
}

// ─── Admin — Settings (ADR-013 phase 4) ───────────────────────────
//
// The backend persists five operational tunable buckets in
// ``app_settings``; each row is a self-contained Pydantic VO. The
// admin panel reads them all in one shot via ``GET /admin/settings``
// and replaces a bucket atomically via ``PATCH /admin/settings/<key>``
// — the body is the full VO payload (no partial PATCH; the UI
// submits the entire form).

/** Bucket identifier — matches ``SettingKey`` on the backend. */
export type AdminSettingKey =
  | "scheduler"
  | "thumbnail_backfill"
  | "intro_detection"
  | "credits_detection"
  | "streaming"
  | "avatar"
  | "scan_dedup";

/** Provenance marker. ``default`` is synthesised by the read endpoint
 *  for buckets that have never been persisted. */
export type AdminSettingSource =
  | "migration_seed"
  | "admin"
  | "sql_override"
  | "default";

/** Scheduler bucket — master switch + reconcile cadence. */
export interface SchedulerSettings {
  enabled: boolean;
  reconcile_interval_minutes: number;
}

/** Thumbnail backfill bucket — cadence + per-tick batch size + subdir. */
export interface ThumbnailBackfillSettings {
  enabled: boolean;
  batch_size: number;
  interval_minutes: number;
  subdir: string;
}

/**
 * Which intro detector the job runs.
 *
 * - ``chromaprint`` — audio-fingerprint cross-correlation (fpcalc).
 *   Lightweight, but blind to intros whose audio theme varies.
 * - ``frame_hash`` — video frame perceptual-hashing with full-offset
 *   matching. Heavier (decodes video) but recovers title sequences
 *   regardless of a variable-length cold open.
 */
export type IntroDetectionAlgorithm = "chromaprint" | "frame_hash";

/** Chromaprint (audio) detector calibration. */
export interface ChromaprintTuning {
  max_hash_hamming: number;
  tolerance_hashes: number;
}

/** Frame-hash (video) detector calibration. */
export interface FrameHashTuning {
  hash_distance_threshold: number;
  frame_sample_fps: number;
  match_tolerance_frames: number;
  max_gap_seconds: number;
}

/** Intro detection bucket — detector selection + per-algorithm tuning. */
export interface IntroDetectionSettings {
  enabled: boolean;
  algorithm: IntroDetectionAlgorithm;
  batch_size: number;
  interval_minutes: number;
  analysis_window_seconds: number;
  min_confidence: number;
  min_intro_seconds: number;
  max_intro_seconds: number;
  chromaprint: ChromaprintTuning;
  frame_hash: FrameHashTuning;
}

/**
 * Credits detection bucket — per-file combined detector (edge + motion).
 * Unlike intro detection there is no algorithm selection: one detector
 * runs both signals and keeps the latest-onset candidate.
 */
export interface CreditsDetectionSettings {
  enabled: boolean;
  batch_size: number;
  interval_minutes: number;
  analysis_window_seconds: number;
  frame_sample_fps: number;
  min_confidence: number;
  min_credits_seconds: number;
  edge_rel_factor: number;
  motion_rel_factor: number;
}

/**
 * Video encoder selection for the transcode + sprite paths.
 *
 * - ``auto`` — probe for a working NVENC encoder and use it, else
 *   fall back to software libx264 (safe default).
 * - ``nvenc`` — force NVIDIA NVENC, skipping the probe.
 * - ``off`` — force software libx264, ignoring any GPU.
 */
export type HardwareAccel = "auto" | "nvenc" | "off";

/** Streaming bucket — ffmpeg parallelism + HLS cache cap + hardware accel. */
export interface StreamingSettings {
  /** ``null`` leaves ffmpeg in auto mode (uses every logical core). */
  ffmpeg_threads: number | null;
  /** ``0`` disables LRU eviction entirely. */
  hls_cache_max_size_mb: number;
  /** Video encoder for the HLS transcode + scrub-preview sprite paths. */
  hw_accel: HardwareAccel;
}

/** Avatar bucket — storage subdir + upload sizing. */
export interface AvatarSettings {
  storage_subdir: string;
  max_size_mb: number;
  size_pixels: number;
}

/**
 * Scan-dedup bucket — runtime-delta bounds that classify a detected
 * content-identity conflict as likely-same vs suspected-different-edit
 * (ADR-015). A pair is only flagged as a different edit when its delta
 * exceeds BOTH bounds.
 */
export interface ScanDedupSettings {
  runtime_delta_abs_minutes: number;
  /** Fraction of the shorter runtime (``0.10`` = 10%). */
  runtime_delta_relative: number;
  /** When ``true``, also flag duplicates by (normalized original
   *  title, year) for entries that never locked a TMDB id. */
  title_year_fallback_enabled: boolean;
  /** When ``true``, the scheduler runs a catalog-wide dedup sweep
   *  on the configured interval (ADR-015 Phase 6.5). */
  sweep_enabled: boolean;
  /** Minutes between successive sweep ticks. Floor is 15. */
  sweep_interval_minutes: number;
}

/**
 * Union of every settings VO payload. The ``key`` on the parent
 * ``AdminSettingDetail`` disambiguates which concrete shape ``value``
 * carries — read sites narrow via ``detail.key === "scheduler"``
 * before touching bucket-specific fields.
 */
export type AdminSettingsValue =
  | SchedulerSettings
  | ThumbnailBackfillSettings
  | IntroDetectionSettings
  | CreditsDetectionSettings
  | StreamingSettings
  | AvatarSettings
  | ScanDedupSettings;

/**
 * Row returned by ``GET /api/v1/admin/settings``. ``source`` is
 * ``"default"`` when the bucket has never been written — the backend
 * synthesises the row from the VO defaults so the UI can render every
 * bucket in a single response.
 */
export interface AdminSettingDetail {
  key: AdminSettingKey;
  value: AdminSettingsValue;
  source: AdminSettingSource;
  updated_by_user_id: string | null;
  /** ISO-8601 UTC; ``null`` for synthesised defaults. */
  updated_at: string | null;
}

export type AdminSettingsResponse = ApiListResponse<AdminSettingDetail>;
export type AdminSettingDetailResponse = ApiDetailResponse<AdminSettingDetail>;

export type AdminScanRunKind = "scan" | "enrich";
export type AdminScanRunTrigger = "manual" | "scheduled";
export type AdminScanRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "interrupted";

/**
 * Row returned by ``GET /api/v1/admin/scans``. Per-kind counters
 * live inside ``summary`` (scans track movies/episodes
 * created+updated; enriches track movies/series enriched + skipped)
 * so the same response shape covers both kinds.
 */
export interface AdminScanRun {
  id: string;
  kind: AdminScanRunKind;
  trigger: AdminScanRunTrigger;
  library_id: string | null;
  status: AdminScanRunStatus;
  started_at: string;
  finished_at: string | null;
  summary: Record<string, number>;
  errors_count: number;
  errors: string[];
}

export type AdminScanRunsResponse = ApiListResponse<AdminScanRun>;
export type AdminScanRunResponse = ApiDetailResponse<AdminScanRun>;

/** One episode's detection outcome within an intro-detection run. */
export interface AdminEpisodeDetectionResult {
  episode_id: string;
  episode_number: number;
  start_seconds: number;
  end_seconds: number;
  confidence: number;
  /** ``false`` when dropped below the confidence floor. */
  persisted: boolean;
}

/** One per-season intro-detection run (audit history row). */
export interface AdminIntroDetectionRun {
  id: string;
  series_id: string;
  series_title: string;
  season_id: string;
  season_number: number;
  algorithm: string;
  outcome: string;
  ref_count: number;
  analyzed_count: number;
  detected_count: number;
  persisted_count: number;
  min_confidence: number;
  error: string | null;
  started_at: string;
  finished_at: string;
  episode_results: AdminEpisodeDetectionResult[];
}

export type AdminIntroDetectionRunsResponse = ApiListResponse<AdminIntroDetectionRun>;

/** One recorded execution of a background scheduler job. */
export interface JobRunRecord {
  id: string;
  job_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

/** A job on the dashboard: live schedule + its last execution. */
export interface JobSummary {
  job_id: string;
  scheduled: boolean;
  schedule: string | null;
  next_run_at: string | null;
  running: boolean;
  last_run: JobRunRecord | null;
  /** Status codes of the newest runs, oldest-first, for the run-health
   *  strip (the most recent outcome is the last element). */
  recent_runs: string[];
}

/** Payload of ``GET /api/v1/admin/jobs``. */
export interface JobsOverview {
  scheduler_running: boolean;
  jobs: JobSummary[];
  /** Total runs started in the last 24 hours. */
  executions_24h: number;
  /** Runs that failed or were interrupted in the last 24 hours. */
  failures_24h: number;
}

export type JobsOverviewResponse = ApiDetailResponse<JobsOverview>;
export type JobRunsResponse = ApiListResponse<JobRunRecord>;

/** Body for ``POST /api/v1/admin/scans``. */
export interface TriggerScanPayload {
  library_id: string;
}

/** Body for ``POST /api/v1/admin/enrichments``. */
export interface TriggerBulkEnrichPayload {
  force: boolean;
}

/**
 * Slim version of the scan-runs row carried inside
 * ``AdminOverviewStats`` for the "Last scan" headline card.
 */
export interface AdminOverviewLastScan {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: AdminScanRunStatus;
}

/**
 * Slim HLS cache view inside ``AdminOverviewStats`` — drops the
 * last-cleared timestamp versus the dedicated System page.
 */
export interface AdminOverviewHlsCache {
  size_bytes: number;
  max_bytes: number;
}

/**
 * Aggregated counts + snapshots backing every card on the
 * admin Overview page. One call replaces five individual
 * endpoints so the cards settle in one loading transition.
 */
export interface AdminOverviewStats {
  movies_count: number;
  series_count: number;
  users_count: number;
  review_count: number;
  last_scan: AdminOverviewLastScan | null;
  hls_cache: AdminOverviewHlsCache;
}

export type AdminOverviewStatsResponse = ApiDetailResponse<AdminOverviewStats>;

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

// Operator flags an already-enriched movie whose metadata matched the
// wrong title — it re-enters the admin needs-review queue so it can be
// relinked to the correct TMDB id.
export interface FlagMovieEnrichmentPayload {
  movie_id: string;
  needs_enrichment_review: boolean;
}

export type FlagMovieEnrichmentResponse = ApiDetailResponse<FlagMovieEnrichmentPayload>;

// ─── Series enrichment review ───────────────────────────────

export interface NeedsReviewSeries {
  id: string;
  title: string;
  year: number;
  tmdb_id: number | null;
}

export interface SeriesTmdbSuggestionsPayload {
  series_id: string;
  // TV candidates only — re-pointing a series at a movie isn't supported.
  series: TmdbSuggestion[];
}

export interface RelinkSeriesInput {
  tmdb_id: number;
  // Backend pins this to "tv"; a movie pick is rejected with a 422.
  media_type: "tv";
}

export interface RelinkSeriesPayload {
  series_id: string;
  enriched: boolean;
  provider: string | null;
  error: string | null;
}

export interface FlagSeriesEnrichmentPayload {
  series_id: string;
  needs_enrichment_review: boolean;
}

export type NeedsReviewSeriesResponse = ApiListResponse<NeedsReviewSeries>;
export type SeriesTmdbSuggestionsResponse = ApiDetailResponse<SeriesTmdbSuggestionsPayload>;
export type RelinkSeriesResponse = ApiDetailResponse<RelinkSeriesPayload>;
export type FlagSeriesEnrichmentResponse = ApiDetailResponse<FlagSeriesEnrichmentPayload>;

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

// ─── Notifications ──────────────────────────────────────────

/**
 * Discriminator for in-app notifications.
 *
 * The renderer keys icon + body fallback off this value. Stays a
 * narrow union so a new kind landing server-side without a
 * matching frontend handler is caught at compile time the next
 * time the dropdown renders it.
 */
export type NotificationKind = "catalog_request_fulfilled";

/**
 * Free-form per-kind payload. The fields are kind-specific —
 * `catalog_request_fulfilled` carries ``tmdb_id``, ``media_id``,
 * and ``media_type``; future kinds may use other keys.
 */
export type NotificationPayload = Record<string, unknown>;

export interface Notification {
  id: string;
  recipient_user_id: string;
  kind: NotificationKind;
  title: string;
  /** Optional subtitle; the renderer falls back to a kind-specific
   *  i18n template when ``null``. */
  body: string | null;
  payload: NotificationPayload;
  is_read: boolean;
  /** ISO-8601 read timestamp, or ``null`` when still unread. */
  read_at: string | null;
  created_at: string;
}

export type NotificationResponse = ApiDetailResponse<Notification>;

/**
 * List shape for ``GET /api/v1/notifications``. The metadata
 * carries the household-wide unread count so the header bell can
 * render the badge off a single round-trip — the dropdown content
 * (possibly filtered to read-only via ``?unread_only``) and the
 * badge stay decoupled.
 */
export interface NotificationsResponse extends ApiListResponse<Notification> {
  metadata: ApiListResponse<Notification>["metadata"] & {
    unread_count?: number;
  };
}

/**
 * Payload returned by ``POST /api/v1/notifications/read-all``.
 *
 * ``marked_read`` reports how many rows flipped on this call; an
 * already-clean inbox returns ``0`` so the frontend can skip
 * branching on the empty case.
 */
export interface MarkAllNotificationsReadPayload {
  marked_read: number;
}

export type MarkAllNotificationsReadResponse =
  ApiDetailResponse<MarkAllNotificationsReadPayload>;

// ---------------------------------------------------------------------------
// Admin — Conflicts (ADR-015 Phase 2)
// ---------------------------------------------------------------------------

/**
 * Which content-identity rule fired the collision on the backend.
 */
export type AdminConflictMatchReason = "tmdb_id" | "title_year_fallback";

/**
 * Pre-computed hint shown next to each row in the queue. The backend
 * derives this from the runtime delta between the two candidates so
 * the UI never has to re-do the math.
 */
export type AdminConflictSuggestedAction =
  | "likely_same_release"
  | "different_edit_suspected";

/**
 * Discriminator for each side of a queued conflict. Phase 1 only
 * writes ``"movie"`` but the schema is polymorphic so ``"series"``
 * lands later without a breaking change.
 */
export type AdminConflictCandidateType = "movie" | "series";

/**
 * Resolution actions accepted by ``POST /admin/conflicts/{id}/resolve``.
 *
 * - ``mark_distinct`` — operator says the pair is intentionally different
 *   (Director's Cut, Theatrical, etc.); detector won't re-queue.
 * - ``merge_replace`` — soft-deletes the loser movie; loser's file
 *   variants are left desreferenciados.
 * - ``merge_keep_both`` — same as ``merge_replace`` plus the loser's
 *   file variants are transferred onto the winner so the player can
 *   pick at playback time.
 */
export type AdminConflictAction =
  | "mark_distinct"
  | "merge_keep_both"
  | "merge_replace";

/**
 * One file variant of a conflict candidate, projected by the backend
 * so the operator can compare on-disk context (path, resolution,
 * size) before deciding a merge.
 */
export interface AdminConflictCandidateFile {
  file_path: string;
  resolution: string;
  file_size: number;
  video_codec: string | null;
  hdr_format: string | null;
  is_primary: boolean;
}

/**
 * Display projection of one side of a conflict pair, hydrated by the
 * backend so the UI doesn't have to round-trip per candidate.
 */
export interface AdminConflictCandidateSummary {
  media_id: string;
  media_type: AdminConflictCandidateType;
  title: string | null;
  year: number | null;
  files: AdminConflictCandidateFile[];
}

/**
 * Resolution provenance for an audit-view row. ``"manual"`` means
 * the admin clicked through the resolve dialog (Phase 2);
 * ``"auto"`` means the post-enrich detector silently absorbed an
 * orphan candidate (Phase 3).
 */
export type AdminConflictResolutionSource = "manual" | "auto";

/**
 * Tab filter for ``GET /admin/conflicts``. ``"pending"`` is the
 * operator queue (default); ``"resolved"`` powers the audit view.
 */
export type AdminConflictListState = "pending" | "resolved";

/**
 * One row in the admin conflict queue or audit view. For pending
 * rows ``resolved_at`` / ``resolution`` / ``winner_id`` /
 * ``resolution_source`` are ``null``; the admin UI uses their
 * presence to switch between the resolve-action affordance and the
 * audit-row read-only chrome.
 */
export interface AdminConflictSummary {
  conflict_id: string;
  candidate_a: AdminConflictCandidateSummary;
  candidate_b: AdminConflictCandidateSummary;
  match_reason: AdminConflictMatchReason;
  runtime_delta_minutes: number | null;
  suggested_action: AdminConflictSuggestedAction;
  detected_at: string;
  resolved_at: string | null;
  resolution: AdminConflictAction | null;
  winner_id: string | null;
  resolution_source: AdminConflictResolutionSource | null;
}

export type AdminConflictsResponse = ApiListResponse<AdminConflictSummary>;

/**
 * Body for ``POST /admin/conflicts/{id}/resolve``. ``winner_id`` is
 * required for ``merge_*`` actions and must be one of the candidate
 * ids; backend rejects with 422 otherwise.
 */
export interface ResolveAdminConflictPayload {
  action: AdminConflictAction;
  winner_id?: string | null;
}

/**
 * Result of a successful resolution call. ``variants_transferred`` is
 * non-zero only for ``merge_keep_both``.
 */
export interface ResolveAdminConflictResult {
  conflict_id: string;
  action: AdminConflictAction;
  winner_id: string | null;
  loser_id: string | null;
  variants_transferred: number;
}

export type ResolveAdminConflictResponse =
  ApiDetailResponse<ResolveAdminConflictResult>;

/** Why a conflict was skipped by the bulk mark-distinct endpoint. */
export type AdminBulkSkipReason = "not_found" | "already_resolved" | "invalid_id";

/** One conflict the bulk operation could not resolve. */
export interface AdminBulkSkippedConflict {
  conflict_id: string;
  reason: AdminBulkSkipReason;
}

/** Body for ``POST /admin/conflicts/bulk-mark-distinct``. */
export interface BulkMarkDistinctPayload {
  conflict_ids: string[];
}

/**
 * Result of a bulk mark-distinct call. ``resolved_ids`` left the
 * pending queue; ``skipped`` lists ids that were missing, malformed,
 * or already resolved (each with a reason).
 */
export interface AdminBulkMarkDistinctResult {
  requested: number;
  resolved_ids: string[];
  skipped: AdminBulkSkippedConflict[];
}

export type AdminBulkMarkDistinctResponse =
  ApiDetailResponse<AdminBulkMarkDistinctResult>;

/**
 * Result of a manual catalog-wide dedup sweep
 * (``POST /admin/conflicts/sweep`` — ADR-015 Phase 6.5).
 */
export interface AdminConflictSweepResult {
  movies_scanned: number;
  conflicts_created: number;
  conflict_ids: string[];
}

export type AdminConflictSweepResponse =
  ApiDetailResponse<AdminConflictSweepResult>;
