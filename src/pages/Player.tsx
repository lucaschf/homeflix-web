import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Slider,
  Typography,
} from "@mui/material";
import {
  ChevronLeft,
  AudioLines,
  Check,
  LayoutList,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useMovie, useProgress, useSaveProgress, useSeriesDetail } from "../api/hooks";
import { ContentRatingBadge } from "../components/ContentRatingBadge";
import { EpisodeDrawer } from "../components/EpisodeDrawer";
import {
  usePlaybackPreferences,
  type SubtitleMode,
} from "../hooks/usePlaybackPreferences";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Clean up track names: remove URLs, site names, normalize encoding. */
function cleanTrackName(name: string): string {
  return name
    .replace(/\s*[/|\\-]\s*(?:www\.|https?:\/\/)[^\s"',]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface HlsAudioTrack {
  id: number;
  name: string;
  lang: string;
}

interface HlsSubtitleTrack {
  id: number;
  name: string;
  lang: string;
}

/**
 * Normalize a language tag so preferences and HLS track `lang`
 * values compare regardless of case, region, or ISO variant.
 *
 * A few media files ship `pt-BR`, others `pt_br`, `por`, `pt`, or
 * `BRAZILIAN PORTUGUESE`. Matching needs to collapse all of them
 * to a canonical two-letter bucket so a preference of `"pt-BR"`
 * also picks up an audio track tagged just `por`. We:
 *
 *   1. Lowercase.
 *   2. Split on `-` / `_` / space and take the first segment —
 *      region tags live after the separator and aren't useful
 *      for language matching (we want `pt` to cover `pt-BR` and
 *      `pt-PT`; the user rarely cares about Portugal-vs-Brazil
 *      at the track level).
 *   3. Collapse common ISO 639-2 three-letter codes to their
 *      ISO 639-1 equivalents via the `ISO_ALIASES` map. Unknown
 *      codes fall through unchanged; exact string matches still
 *      work for languages we haven't explicitly aliased.
 */
const ISO_ALIASES: Record<string, string> = {
  por: "pt",
  eng: "en",
  spa: "es",
  fra: "fr",
  fre: "fr",
  ger: "de",
  deu: "de",
  ita: "it",
  jpn: "ja",
  kor: "ko",
  chi: "zh",
  zho: "zh",
  rus: "ru",
};

function normalizeLang(tag: string | null | undefined): string {
  if (!tag) return "";
  const head = tag.toLowerCase().split(/[-_\s]/)[0] ?? "";
  return ISO_ALIASES[head] ?? head;
}

/**
 * Find the track whose `lang` best matches the preference.
 *
 * Returns `null` if no track carries language metadata matching
 * the preference — the caller keeps the HLS default (usually
 * track index 0) in that case. The helper is deliberately tiny
 * because the preference system is opt-in; if a user's catalog
 * has tracks without `lang` tags, the preference silently becomes
 * a no-op and the player falls back to its legacy behavior.
 */
function findTrackByLang<T extends { id: number; lang: string }>(
  tracks: readonly T[],
  preferredLang: string,
): T | null {
  const want = normalizeLang(preferredLang);
  if (!want) return null;
  return tracks.find((track) => normalizeLang(track.lang) === want) ?? null;
}

/**
 * Pick the subtitle track id to auto-enable for a new media,
 * respecting the user's mode + language preferences.
 *
 * Returns `null` when nothing should be auto-enabled — the
 * caller then leaves `hls.subtitleTrack` at its default (-1,
 * "no subtitles"). This keeps the call-site logic straight: if
 * the helper returns a number, assign it; otherwise do nothing.
 *
 * The `chosenAudioLang` argument is the *normalized* language of
 * the audio track the player just committed to (saved value or
 * preference match or HLS default), NOT the user's audio
 * preference. `foreignOnly` specifically needs to compare the
 * ACTUAL audio being played against the viewer's native language
 * (represented by `preferredSubLang`), so passing the preference
 * here would be wrong when the user is watching a catalog item
 * whose only audio happens to match their subtitle language.
 */
function pickPreferredSubtitleId(
  hls: Hls,
  chosenAudioLang: string,
  preferredSubLang: string,
  mode: SubtitleMode,
): number | null {
  // Two equivalent off switches: the mode itself, or setting the
  // preferred subtitle language to "off" in the dropdown. Either
  // one short-circuits the whole pick.
  if (mode === "off" || preferredSubLang === "off") return null;

  if (mode === "forcedOnly") {
    // HLS manifests can tag a subtitle track as FORCED — typically
    // used for foreign-dialogue signs embedded in an otherwise
    // same-language release. hls.js propagates the attribute on
    // each subtitle track but the TS definitions don't expose it
    // directly on the public type, so we read it through a narrow
    // structural cast instead of the whole `MediaPlaylist`.
    const forced = hls.subtitleTracks.find(
      (t) => (t as unknown as { forced?: boolean }).forced === true,
    );
    return forced?.id ?? null;
  }

  const langMatch = findTrackByLang(hls.subtitleTracks, preferredSubLang);
  if (!langMatch) return null;

  if (mode === "always") return langMatch.id;

  if (mode === "foreignOnly") {
    // Show subs only when the selected audio is in a different
    // language from the viewer's native (= their subtitle lang).
    // A viewer with sub pref "pt-BR" watching a pt-BR audio track
    // gets no subs; the same viewer on a "ja" audio track gets
    // the Portuguese subtitle track auto-enabled.
    return chosenAudioLang !== normalizeLang(preferredSubLang)
      ? langMatch.id
      : null;
  }

  return null;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Persisted player preferences. Stored in localStorage under the
// `homeflix.player.*` namespace so future preferences (default playback
// speed, default subtitle language, etc.) can share the same prefix.
const VOLUME_STORAGE_KEY = "homeflix.player.volume";
const MUTED_STORAGE_KEY = "homeflix.player.muted";

function readPersistedVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null) return 1;
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return 1;
    // Clamp defensively against tampered/corrupt values.
    return Math.min(1, Math.max(0, parsed));
  } catch {
    // localStorage can throw in private mode or when disabled.
    return 1;
  }
}

function readPersistedMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function Player() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{
    movieId?: string;
    seriesId?: string;
    season?: string;
    episode?: string;
  }>();

  const isMovie = !!params.movieId;

  const mediaId = isMovie
    ? params.movieId ?? ""
    : `epi_${params.seriesId}_${params.season}_${params.episode}`;
  const mediaType = isMovie ? "movie" : "episode";

  const { data: movieData, isLoading: movieLoading } = useMovie(params.movieId ?? "");
  const { data: seriesData, isLoading: seriesLoading } = useSeriesDetail(params.seriesId ?? "");
  const { data: savedProgress, isPending: progressPending } = useProgress(mediaId);
  const mediaLoading = isMovie ? movieLoading : seriesLoading;

  // User-level playback preferences from localStorage. The Player
  // reads most prefs (audio/sub/quality) and writes back `speed`
  // when the user changes it so the choice survives across episodes
  // and navigation.
  const [playbackPrefs, setPlaybackPrefs] = usePlaybackPreferences();

  // Start offset passed to the backend via ?start=X. CRITICAL: this must be
  // captured exactly ONCE per (mediaId, savedProgress-resolution) pair, NOT
  // once per component mount.
  //
  // - Pinning it to the first savedProgress for a given mediaId is what
  //   stops the 10-second auto-save from invalidating the query, refetching
  //   the just-saved position, recomputing the offset, mutating hlsUrl, and
  //   destroying the HLS instance every 10 seconds (the original "preparing
  //   video toda hora" + audio-cut + jump-around bug).
  //
  // - Re-pinning when mediaId changes is what stops the auto-advance flow
  //   from carrying the previous episode's offset into the next one. The
  //   <Player /> route component does NOT unmount across episode navigation
  //   (the React Router path stays `/play/episode/:seriesId/:season/:episode`,
  //   only the params change), so a mount-scoped pin would otherwise survive
  //   into the next episode and ffmpeg would trim the new playlist starting
  //   at the previous episode's resume position.
  //
  // The pinned record is a single object so the (mediaId, offset) pair can
  // never be partially updated by a future refactor — both fields move
  // together by construction. `null` means "not pinned for any media yet";
  // a value means "this offset belongs to exactly THIS mediaId".
  const [pinned, setPinned] = useState<{ mediaId: string; offset: number } | null>(null);
  useEffect(() => {
    if (pinned?.mediaId === mediaId) return;
    if (progressPending) return;
    const offset =
      savedProgress && savedProgress.status !== "completed"
        ? Math.max(0, Math.floor(savedProgress.position_seconds))
        : 0;
    // Synchronizing async query state into local state — there is no
    // pure derivation here because we need to "snapshot" the saved
    // position the first time it resolves for a given mediaId and then
    // hold it stable for the rest of the player's lifetime on that
    // mediaId. Pure derivation would refetch + recompute the offset on
    // every progress invalidation, which is the original "preparing
    // video toda hora" bug. The cascading-render warning is acknowledged
    // and the cascade is bounded (one render per mediaId change).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinned({ mediaId, offset });
  }, [mediaId, progressPending, savedProgress, pinned]);

  // Only safe to consume the offset for display math / HLS URL once it has
  // been pinned for the CURRENT mediaId. Until then `isLoading` keeps the
  // player in the loading state and the HLS effect stays unmounted, so the
  // (still stale from the previous episode) offset is never read by
  // anything user-visible. Code paths that touch `startOffset` directly
  // (the save handlers below) ALSO bail out on `!isReadyForCurrentMedia`
  // to make the coupling explicit instead of relying on indirect guards
  // like `video.paused` having already updated.
  const isReadyForCurrentMedia = pinned?.mediaId === mediaId;
  const startOffset = isReadyForCurrentMedia ? pinned.offset : 0;

  // Wait for both media metadata AND the start offset to be pinned for the
  // current mediaId before mounting HLS.
  const isLoading = mediaLoading || !isReadyForCurrentMedia;

  // Determine HLS playlist URL with optional start offset
  const hlsUrl = (() => {
    if (isLoading) return "";
    const base = isMovie
      ? `/api/v1/stream/movie/${params.movieId}/hls/playlist.m3u8`
      : `/api/v1/stream/episode/${params.seriesId}/${params.season}/${params.episode}/hls/playlist.m3u8`;
    return startOffset > 0 ? `${base}?start=${startOffset}` : base;
  })();

  const seasonNum = isMovie ? 0 : Number(params.season);
  const episodeNum = isMovie ? 0 : Number(params.episode);

  // Find episode duration from series data
  const episodeDuration = (() => {
    if (isMovie || !seriesData) return 0;
    const season = seriesData.seasons.find((s) => s.season_number === seasonNum);
    const episode = season?.episodes.find((e) => e.episode_number === episodeNum);
    return episode?.duration_seconds ?? 0;
  })();

  // Compute next episode for auto-advance
  const nextEpisode = useMemo(() => {
    if (isMovie || !seriesData) return null;
    const sortedSeasons = [...seriesData.seasons].sort((a, b) => a.season_number - b.season_number);
    const seasonIdx = sortedSeasons.findIndex((s) => s.season_number === seasonNum);
    if (seasonIdx < 0) return null;
    const season = sortedSeasons[seasonIdx];
    const sortedEps = [...season.episodes].sort((a, b) => a.episode_number - b.episode_number);
    const epIdx = sortedEps.findIndex((e) => e.episode_number === episodeNum);

    let nextSeason: number;
    let nextEpNum: number;
    let nextTitle: string;

    if (epIdx >= 0 && epIdx < sortedEps.length - 1) {
      // Next episode in same season
      const ep = sortedEps[epIdx + 1];
      nextSeason = seasonNum;
      nextEpNum = ep.episode_number;
      nextTitle = ep.title;
    } else if (seasonIdx < sortedSeasons.length - 1) {
      // First episode of next season
      const ns = sortedSeasons[seasonIdx + 1];
      const firstEp = [...ns.episodes].sort((a, b) => a.episode_number - b.episode_number)[0];
      if (!firstEp) return null;
      nextSeason = ns.season_number;
      nextEpNum = firstEp.episode_number;
      nextTitle = firstEp.title;
    } else {
      return null;
    }

    const label = `S${String(nextSeason).padStart(2, "0")}E${String(nextEpNum).padStart(2, "0")}`;
    return {
      season: nextSeason,
      episode: nextEpNum,
      title: nextTitle ? `${label} - ${nextTitle}` : label,
    };
  }, [isMovie, seriesData, seasonNum, episodeNum]);
  // Stable handle to the latest mutate function so the auto-save interval
  // and saveCurrentProgress callback don't have to take `saveProgress.mutate`
  // as a dependency (which would re-bind the interval every render and
  // re-fire downstream effects). The ref is updated in an effect — NOT
  // during render — because writing to a ref's `.current` during render
  // is unsafe under concurrent rendering (this is the official React 19
  // guidance enforced by `react-hooks/refs`).
  const saveProgress = useSaveProgress();
  const saveProgressRef = useRef(saveProgress.mutate);
  useEffect(() => {
    saveProgressRef.current = saveProgress.mutate;
  }, [saveProgress.mutate]);
  // Heading shown above the seek bar. Movies are a single line; series get
  // the show name on top with the SxxExx (+ episode title when available)
  // as a second smaller line below.
  const heading: { title: string; subtitle?: string } = isMovie
    ? { title: movieData?.title ?? "" }
    : (() => {
        const season = seriesData?.seasons.find((s) => s.season_number === seasonNum);
        const episode = season?.episodes.find((e) => e.episode_number === episodeNum);
        const epTitle = episode?.title ?? "";
        const prefix = `S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")}`;
        return {
          title: seriesData?.title ?? "",
          subtitle: epTitle ? `${prefix} · ${epTitle}` : prefix,
        };
      })();

  const videoRef = useRef<HTMLVideoElement>(null);
  // Stored as state (set via the callback ref `setContainerEl`) instead of
  // a useRef so the MUI Menu `container` props below — which need the DOM
  // element to portal into — can read the value without touching `.current`
  // during render. `react-hooks/refs` (React 19) flags ref reads in render
  // because the ref is null on the first pass and only populated on commit,
  // so passing it directly produces a flicker / wrong portal target on the
  // initial render. State plus a callback ref makes the element observable
  // and triggers a re-render once the Box is attached.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  // Holds the mediaId whose audio/subtitle selection has already been
  // restored from savedProgress, so the restore effect runs again the first
  // time `mediaId` changes (e.g. on auto-advance to the next episode). A
  // simple boolean would lock after the first episode and silently skip
  // restoring tracks for every episode after that.
  const progressRestoredForMediaIdRef = useRef<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transient action indicator — shows a brief icon + label in the
  // center of the viewport when a keyboard shortcut fires (e.g.
  // "⏪ -10s", "▶ Play", "🔇 Muted"). Cleared by a 600ms timer so
  // the indicator fades out automatically. `null` = nothing to show.
  // A monotonic `seq` counter forces React to re-mount the Box (via
  // `key`) on every trigger so the CSS animation restarts — using
  // `Date.now()` would trip the react-hooks/purity lint.
  const actionSeqRef = useRef(0);
  const [actionIndicator, setActionIndicator] = useState<{
    seq: number;
    icon: React.ReactNode;
    label?: string;
  } | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showAction = useCallback(
    (icon: React.ReactNode, label?: string) => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionSeqRef.current += 1;
      setActionIndicator({ seq: actionSeqRef.current, icon, label });
      actionTimerRef.current = setTimeout(() => setActionIndicator(null), 600);
    },
    [],
  );

  const [playing, setPlaying] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [nextEpCountdown, setNextEpCountdown] = useState<number | null>(null);
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // The furthest buffered position in DISPLAY time (internal + startOffset).
  // Updated on the `progress` event so the seek bar can show a secondary
  // fill representing the already-downloaded portion of the stream.
  const [bufferedEnd, setBufferedEnd] = useState(0);
  // Persisted via localStorage so the volume and mute state survive across
  // navigations and reloads. Without this the <video> element resets to its
  // browser default of volume=1 every time the player mounts. The state is
  // pushed back into the actual video element by an effect below — setting
  // the React state alone isn't enough because the video element default
  // overrides it on attach.
  const [volume, setVolume] = useState<number>(readPersistedVolume);
  const [muted, setMuted] = useState<boolean>(readPersistedMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // Speed is derived from playbackPrefs so it persists across
  // episodes and sessions. The local alias avoids a rename cascade
  // throughout the JSX.
  const speed = playbackPrefs.speed;
  const [hlsReady, setHlsReady] = useState(false);
  const [buffering, setBuffering] = useState(false);

  // Audio / subtitle track state
  const [audioTracks, setAudioTracks] = useState<HlsAudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState<HlsSubtitleTrack[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(-1);

  // Use metadata duration as authoritative source (movie or episode).
  // When the API doesn't expose a canonical duration we fall back to the
  // <video> element's own duration, but that one reflects the TRIMMED HLS
  // (the ?start=X cut), so we add startOffset back to recover the original
  // source duration. This single value is the source of truth for both the
  // scrubber max AND the duration_seconds we POST to /watch-progress, so
  // both stay aligned without per-call fallback chains.
  const knownDuration = isMovie ? (movieData?.duration_seconds ?? 0) : episodeDuration;
  const displayDuration =
    knownDuration > 0 ? knownDuration : duration > 0 ? duration + startOffset : 0;

  // Quality list pulled from the movie's file variants. `files` is hoisted
  // into a local so the same reference feeds both the memo and the derived
  // `quality` value below — kept as `T[] | undefined` (NOT `?? []`) on
  // purpose: a fallback empty array would be a fresh reference on every
  // render during loading and would defeat the whole point of the memo by
  // making `files` change identity every pass.
  const files = movieData?.files;
  const qualities = useMemo(
    () => files?.map((f) => f.resolution) ?? [],
    [files],
  );

  // `quality` is derived from, in order:
  //   1. The user's manual override for THIS session (wins over
  //      everything once they click a resolution in the player menu).
  //   2. The `defaultQuality` preference from Settings (e.g. always
  //      pick 1080p when available), but only when that resolution
  //      actually exists in the file list and the user hasn't chosen
  //      "best" — "best" means "let the file list decide".
  //   3. The file marked as `is_primary`.
  //   4. The first file in the list.
  //   5. Empty string (no files yet — the player shows the loading
  //      overlay in this case).
  //
  // This used to be a state plus a useEffect that called setQuality
  // after files arrived, but that pattern trips
  // `react-hooks/set-state-in-effect` (React 19's anti-cascading-render
  // rule). Pure derivation removes the effect and the cascade entirely:
  // the override state survives across re-renders, and every default
  // falls out of `files` whenever it resolves.
  //
  // Both the override and the preference are validated against the
  // current `files` on every render so navigating from a movie that
  // has 1080p to one that doesn't carries no stale state — the
  // validity check fails and we fall through the chain. Neither
  // state is cleared (no setState in render), so if the user later
  // navigates back to a movie that does have 1080p, the override /
  // preference "wakes up" again. This is intentional: both store
  // intent, validation enforces feasibility.
  const [qualityOverride, setQualityOverride] = useState<string | null>(null);
  const overrideMatchesAvailableFile =
    qualityOverride !== null &&
    (files?.some((f) => f.resolution === qualityOverride) ?? false);
  const preferredQuality = playbackPrefs.defaultQuality;
  const preferenceMatchesAvailableFile =
    preferredQuality !== "best" &&
    (files?.some((f) => f.resolution === preferredQuality) ?? false);
  const quality =
    (overrideMatchesAvailableFile ? qualityOverride : null) ??
    (preferenceMatchesAvailableFile ? preferredQuality : null) ??
    files?.find((f) => f.is_primary)?.resolution ??
    files?.[0]?.resolution ??
    "";

  // Show a brief toast when the user's preferred quality can't be
  // honoured for this media — so the viewer knows the resolution
  // dropped instead of silently getting a lower-quality stream.
  // Runs once per mediaId when files resolve; the ref prevents
  // re-firing on every render.
  const qualityToastFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!files || files.length === 0) return;
    if (qualityToastFiredForRef.current === mediaId) return;
    if (preferredQuality === "best" || preferenceMatchesAvailableFile) return;
    // Preference is set to a specific resolution that doesn't exist
    // on this media — the chain fell through to the primary/first.
    qualityToastFiredForRef.current = mediaId;
    showAction(
      <Settings size={24} />,
      `${preferredQuality} ${t("player.notAvailable")}, ${quality}`,
    );
  }, [files, mediaId, preferredQuality, preferenceMatchesAvailableFile, quality, showAction, t]);

  // Settings menu
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  type SettingsPanel = "main" | "quality" | "speed";
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>("main");

  // Audio menu (separate from settings)
  const [audioAnchor, setAudioAnchor] = useState<null | HTMLElement>(null);

  // Subtitle menu (separate from settings)
  const [subtitleAnchor, setSubtitleAnchor] = useState<null | HTMLElement>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // currentTime state stores the DISPLAY time (video.currentTime + startOffset)
    // so the scrubber and timestamp reflect the absolute position in the
    // original source, even when the backend trimmed via ?start=X.
    const onTimeUpdate = () => setCurrentTime(video.currentTime + startOffset);
    const onLoadedMetadata = () => {
      if (!knownDuration) setDuration(video.duration);
    };
    const onPlay = () => {
      setPlaying(true);
      // Show rating badge for 5 seconds on play
      setShowBadge(true);
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
      badgeTimerRef.current = setTimeout(() => setShowBadge(false), 5000);
    };
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onPlaying = () => { setHlsReady(true); setBuffering(false); };
    const onWaiting = () => setBuffering(true);
    // `progress` fires as the browser downloads segments. We read
    // the furthest buffered byte-range and expose it as display-time
    // so the seek bar can paint the buffered zone.
    const onProgress = () => {
      if (video.buffered.length > 0) {
        const end = video.buffered.end(video.buffered.length - 1);
        setBufferedEnd(end + startOffset);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("progress", onProgress);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("progress", onProgress);
    };
    // isLoading is in the deps so this effect re-runs when the loading
    // overlay clears and the <video> element appears in the DOM. Without
    // it, the listeners would attach during the first render (when
    // videoRef.current is still null because of the early-return loading
    // screen) and never re-attach, leaving the player stuck on the
    // "preparing video" overlay even after playback starts.
  }, [knownDuration, startOffset, isLoading]);

  // Initialize HLS
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Resetting `hlsReady` is intentional: every time hlsUrl changes
    // (new movie, new episode, ?start=X switch) the previous HLS
    // instance is destroyed and a new one is built below — playback is
    // not ready until the new instance fires `playing` again. The
    // cascading render is bounded (one per hlsUrl change) and is what
    // gates the loading overlay across episode transitions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHlsReady(false);

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startPosition: 0,
        liveSyncDuration: 0,
        liveMaxLatencyDuration: undefined,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      // Track audio tracks from HLS manifest
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        const tracks = hls.audioTracks.map((t) => ({
          id: t.id,
          name: cleanTrackName(t.name || t.lang || `Track ${t.id}`),
          lang: t.lang || "",
        }));
        setAudioTracks(tracks);
        setCurrentAudioTrack(hls.audioTrack);
      });


      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
        setCurrentAudioTrack(data.id);
      });

      // Track subtitle tracks from HLS manifest
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        const tracks = hls.subtitleTracks.map((t) => ({
          id: t.id,
          name: t.name || t.lang || `Subtitle ${t.id}`,
          lang: t.lang || "",
        }));
        setSubtitleTracks(tracks);
        setCurrentSubtitleTrack(hls.subtitleTrack);
      });

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
        setCurrentSubtitleTrack(data.id);
      });

      let retryTimeout: ReturnType<typeof setTimeout> | null = null;
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error("[HLS Error]", data.type, data.details, data.fatal, data);
        if (data.fatal) {
          setHlsReady(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              retryTimeout = setTimeout(() => hls.startLoad(), 3000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
      hlsRef.current = hls;

      return () => {
        if (retryTimeout) clearTimeout(retryTimeout);
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }

    return undefined;
  }, [hlsUrl]);

  // Push the persisted volume / muted state into the actual <video> element
  // every time it becomes ready (hlsReady flips when a new media starts) or
  // when the user changes those values via the controls. Without this the
  // browser default of volume=1 wins on every fresh attach because the
  // React state alone doesn't reach the underlying element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    // Re-apply persisted speed alongside volume so a binge-watcher's
    // 1.5x survives across episode auto-advances — the new HLS
    // instance resets `playbackRate` to 1 on attach.
    video.playbackRate = speed;
  }, [volume, muted, speed, hlsReady]);

  // Persist volume / mute changes to localStorage so the next session
  // starts at the same level. Wrapped in try/catch because localStorage
  // can throw in private mode or with a full quota — failing to persist
  // is not worth breaking playback over. Both writes share one effect so
  // there's a single best-effort boundary; the small extra `setItem` when
  // only one of the two changes is microseconds and never measurable
  // even on a fast slider drag.
  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
      localStorage.setItem(MUTED_STORAGE_KEY, String(muted));
    } catch {
      /* persistence is best-effort */
    }
  }, [volume, muted]);

  // Restore audio/subtitle track selection on first play.
  //
  // Priority order for each track:
  //   1. Saved per-media selection from `savedProgress` (the user
  //      picked a specific track last time they watched this item).
  //   2. Global language preference from Settings, matched against
  //      the HLS track metadata.
  //   3. HLS default (audio track 0, subtitles off).
  //
  // Position is already handled by the backend via `?start=startOffset` —
  // ffmpeg starts transcoding from that point, so the video element
  // begins at internal currentTime = 0 and no seek is needed here.
  //
  // The "already restored" guard is keyed on mediaId so the effect
  // re-runs the first time hls becomes ready for a new episode
  // (auto-advance) — a simple boolean flag would lock after the
  // first episode and silently skip restoring tracks for every
  // episode after that.
  //
  // We gate on `!progressPending` (not just `!!savedProgress`) so
  // a cold load where savedProgress resolves a beat later than the
  // video doesn't race: the effect waits for the query to settle,
  // then picks saved-or-preference in a single pass. Without this
  // guard, preferences would be applied first and then the guard
  // would block the saved value from ever landing.
  useEffect(() => {
    if (progressPending) return;
    if (progressRestoredForMediaIdRef.current === mediaId) return;
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || !hlsReady || !hls) return;

    progressRestoredForMediaIdRef.current = mediaId;

    // ── Audio ───────────────────────────────────────────────
    // Setting hls.audioTrack on HLS.js — even to the same value
    // it already is — can trigger a buffer flush of the audio
    // segments, which manifests as the audio dropping out for a
    // few seconds right after playback starts. So we compare
    // before assigning in every branch.
    const savedAudio = savedProgress?.audio_track;
    let chosenAudioLang = normalizeLang(
      hls.audioTracks[hls.audioTrack]?.lang ?? "",
    );
    if (savedAudio != null && savedAudio !== 0) {
      if (hls.audioTrack !== savedAudio) hls.audioTrack = savedAudio;
      chosenAudioLang = normalizeLang(hls.audioTracks[savedAudio]?.lang ?? "");
    } else {
      const audioMatch = findTrackByLang(hls.audioTracks, playbackPrefs.audioLang);
      if (audioMatch && hls.audioTrack !== audioMatch.id) {
        hls.audioTrack = audioMatch.id;
        chosenAudioLang = normalizeLang(audioMatch.lang);
      }
    }

    // ── Subtitles ───────────────────────────────────────────
    // Decide the preferred subtitle id BASED on the audio lang we
    // just committed to (not the audio preference) so foreignOnly
    // compares against the track that's actually going to play.
    const savedSub = savedProgress?.subtitle_track;
    if (savedSub != null && savedSub !== -1) {
      if (hls.subtitleTrack !== savedSub) hls.subtitleTrack = savedSub;
    } else {
      const subtitleChoice = pickPreferredSubtitleId(
        hls,
        chosenAudioLang,
        playbackPrefs.subtitleLang,
        playbackPrefs.subtitleMode,
      );
      if (subtitleChoice != null && hls.subtitleTrack !== subtitleChoice) {
        hls.subtitleTrack = subtitleChoice;
      }
    }
  }, [
    savedProgress,
    progressPending,
    hlsReady,
    mediaId,
    playbackPrefs.audioLang,
    playbackPrefs.subtitleLang,
    playbackPrefs.subtitleMode,
  ]);

  // Auto-save progress every 10 seconds during playback
  useEffect(() => {
    if (!playing) return;
    // Explicit guard: startOffset only carries the correct value once the
    // pin matches the current mediaId. Without this, the brief window
    // between params change and pin re-resolution could fire a save with
    // startOffset=0 against the new mediaId.
    if (!isReadyForCurrentMedia) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || !mediaId) return;
      if (!displayDuration) return;
      saveProgressRef.current({
        media_id: mediaId,
        media_type: mediaType,
        position_seconds: Math.floor(video.currentTime + startOffset),
        duration_seconds: Math.floor(displayDuration),
        audio_track: hlsRef.current?.audioTrack,
        subtitle_track: hlsRef.current?.subtitleTrack,
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [playing, mediaId, mediaType, displayDuration, startOffset, isReadyForCurrentMedia]);

  // Save progress on pause or unmount
  const saveCurrentProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !mediaId) return;
    // Same explicit guard as the auto-save interval — never POST a
    // position computed from a stale startOffset against the new mediaId.
    if (!isReadyForCurrentMedia) return;
    // Don't save if nothing has been watched yet (avoid overwriting a
    // resumable position with 0 on quick unmount).
    if (!displayDuration || (video.currentTime === 0 && startOffset === 0)) return;
    saveProgressRef.current({
      media_id: mediaId,
      media_type: mediaType,
      position_seconds: Math.floor(video.currentTime + startOffset),
      duration_seconds: Math.floor(displayDuration),
      audio_track: hlsRef.current?.audioTrack,
      subtitle_track: hlsRef.current?.subtitleTrack,
    });
  }, [mediaId, mediaType, displayDuration, startOffset, isReadyForCurrentMedia]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("pause", saveCurrentProgress);
    return () => video.removeEventListener("pause", saveCurrentProgress);
  }, [saveCurrentProgress]);

  // Save on page unload via `sendBeacon`, which is the only
  // reliable way to get data out during `beforeunload` — a normal
  // `fetch` is frequently cancelled by the browser before it reaches
  // the network. `sendBeacon` is a fire-and-forget POST that the
  // browser guarantees to dispatch even after the page is torn down.
  //
  // We still use the regular mutation for pause saves (which need
  // cache invalidation / retry); the beacon is the last-ditch path
  // for tab-close / navigation-away only.
  useEffect(() => {
    const onBeforeUnload = () => {
      const video = videoRef.current;
      if (!video || !mediaId || !isReadyForCurrentMedia) return;
      if (!displayDuration || (video.currentTime === 0 && startOffset === 0)) return;
      const body = JSON.stringify({
        media_id: mediaId,
        media_type: mediaType,
        position_seconds: Math.floor(video.currentTime + startOffset),
        duration_seconds: Math.floor(displayDuration),
        audio_track: hlsRef.current?.audioTrack,
        subtitle_track: hlsRef.current?.subtitleTrack,
      });
      // Wrap in a Blob with the correct Content-Type — sendBeacon
      // defaults to text/plain for bare strings, and the backend
      // expects application/json.
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/v1/progress", blob);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mediaId, mediaType, displayDuration, startOffset, isReadyForCurrentMedia]);

  const seriesDetailPath = params.seriesId ? `/series/${params.seriesId}` : "/";

  const goToNextEpisode = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setNextEpCountdown(null);
    if (nextEpisode) {
      navigate(`/play/episode/${params.seriesId}/${nextEpisode.season}/${nextEpisode.episode}`, { replace: true });
    } else {
      navigate(seriesDetailPath, { replace: true });
    }
  }, [nextEpisode, navigate, params.seriesId, seriesDetailPath]);

  const cancelNextEpisode = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setNextEpCountdown(null);
  }, []);

  // Start countdown when episode ends
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isMovie) return;

    const onEnded = () => {
      saveCurrentProgress();
      if (!nextEpisode) {
        navigate(seriesDetailPath, { replace: true });
        return;
      }
      setNextEpCountdown(10);
      countdownTimerRef.current = setInterval(() => {
        setNextEpCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [isMovie, nextEpisode, navigate, saveCurrentProgress, seriesDetailPath]);

  // Navigate when countdown reaches 0. The state-in-effect lint is
  // unavoidable here: `goToNextEpisode` calls `navigate(...)` AND
  // `setNextEpCountdown(null)` to clean up. Inlining the navigate into
  // the setInterval that decrements the countdown would mean calling
  // setState inside another setState updater, which is worse than the
  // bounded one-shot cascade this effect produces (one render when
  // countdown hits 0, then the next-episode mount takes over).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextEpCountdown === 0) goToNextEpisode();
  }, [nextEpCountdown, goToNextEpisode]);

  // Cleanup stray timers on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, []);

  // Hoisted above the keyboard handler effect (and wrapped in useCallback)
  // so the effect can list it as a dependency without triggering eslint's
  // "used before declared" error. `containerEl` is in the deps because
  // the callback closes over its value; the only time the identity changes
  // is when the Box mounts/unmounts (once per session), so the keyboard
  // effect re-bind is a no-op for the user.
  //
  // Note: this only ASKS the browser to enter or exit fullscreen — the
  // actual `isFullscreen` state is updated by the `fullscreenchange`
  // listener below, so it stays correct even when the user exits via
  // Esc, F11, or any other browser-native exit path.
  const toggleFullscreen = useCallback(() => {
    if (!containerEl) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerEl.requestFullscreen();
    }
  }, [containerEl]);

  // Source-of-truth sync for `isFullscreen`. Without this, pressing Esc
  // (browser-native fullscreen exit) leaves `isFullscreen === true`,
  // which breaks the keyboard handler's Esc branch and any UI that
  // depends on the flag. Listening to `fullscreenchange` and reading
  // back from `document.fullscreenElement` is the canonical pattern.
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          if (video.paused) {
            video.play().catch(() => {});
            showAction(<Play size={36} fill="var(--mui-palette-overlayText-primary)" />);
          } else {
            video.pause();
            showAction(<Pause size={36} />);
          }
          break;
        case "arrowleft":
          video.currentTime = Math.max(0, video.currentTime - 10);
          showAction(<SkipBack size={32} />, "-10s");
          resetHideTimer();
          break;
        case "arrowright":
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 30);
          showAction(<SkipForward size={32} />, "+30s");
          resetHideTimer();
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((v) => { const nv = Math.min(1, v + 0.1); video.volume = nv; return nv; });
          showAction(<Volume2 size={32} />);
          resetHideTimer();
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((v) => { const nv = Math.max(0, v - 0.1); video.volume = nv; return nv; });
          showAction(<VolumeX size={32} />);
          resetHideTimer();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          setMuted((m) => {
            video.muted = !m;
            showAction(!m ? <VolumeX size={32} /> : <Volume2 size={32} />);
            return !m;
          });
          resetHideTimer();
          break;
        case "a":
          // Toggle audio track menu. Uses containerEl as the anchor
          // since there's no mouse position; the menu's anchorOrigin
          // places it in the bottom-right corner near the controls.
          setAudioAnchor((prev) => (prev ? null : containerEl));
          showAction(<AudioLines size={28} />);
          break;
        case "s":
          setSubtitleAnchor((prev) => (prev ? null : containerEl));
          showAction(<Subtitles size={28} />);
          break;
        case "escape":
          if (isFullscreen) document.exitFullscreen();
          else navigate(-1);
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [containerEl, displayDuration, isFullscreen, navigate, resetHideTimer, showAction, toggleFullscreen]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      showAction(<Play size={36} fill="var(--mui-palette-overlayText-primary)" />);
    } else {
      video.pause();
      showAction(<Pause size={36} />);
    }
  };

  const seek = (displayValue: number) => {
    const video = videoRef.current;
    if (!video) return;
    // Convert display time to internal (trimmed) time. Clamp to [0, trimmed
    // duration]: seeking before startOffset is not possible with the current
    // trimmed transcode, so we silently clamp to the earliest available
    // frame. (TODO: trigger a reload with ?start=0 if the user wants to
    // rewind before startOffset.)
    const internalTime = Math.max(
      0,
      Math.min(video.duration || Infinity, displayValue - startOffset),
    );
    video.currentTime = internalTime;
    setCurrentTime(internalTime + startOffset);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const maxInternal = video.duration || Infinity;
    video.currentTime = Math.max(0, Math.min(maxInternal, video.currentTime + seconds));
    resetHideTimer();
  };

  const changeVolume = (_: unknown, value: number | number[]) => {
    const v = value as number;
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
    setMuted(v === 0);
  };

  const changeSpeed = (s: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = s;
    setPlaybackPrefs({ speed: s });
    setSettingsAnchor(null);
    setSettingsPanel("main");
  };

  const changeAudioTrack = (trackId: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.audioTrack = trackId;
    setAudioAnchor(null);
  };

  const changeSubtitleTrack = (trackId: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.subtitleTrack = trackId;
    setSubtitleAnchor(null);
  };

  const openSettings = (e: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchor(e.currentTarget);
    setSettingsPanel("main");
  };

  const openAudio = (e: React.MouseEvent<HTMLElement>) => {
    setAudioAnchor(e.currentTarget);
  };

  const openSubtitles = (e: React.MouseEvent<HTMLElement>) => {
    setSubtitleAnchor(e.currentTarget);
  };

  // Show loading while fetching movie data
  if (isLoading) {
    return (
      <Box sx={{ position: "fixed", inset: 0, bgcolor: "common.black", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const subtitlesActive = currentSubtitleTrack >= 0;

  return (
    <Box
      ref={setContainerEl}
      onMouseMove={resetHideTimer}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        bgcolor: "common.black",
        cursor: showControls ? "default" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <video
        ref={videoRef}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />

      {/* Loading overlay while HLS is preparing or buffering */}
      {(!hlsReady || buffering) && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            bgcolor: hlsReady ? "transparent" : "rgba(0,0,0,0.7)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <CircularProgress color="primary" size={48} />
          {!hlsReady && (
            <Typography variant="body1" color="overlayText.primary">
              {t("player.preparing")}
            </Typography>
          )}
        </Box>
      )}

      {/* Keyboard action indicator — brief icon + label feedback */}
      {actionIndicator && (
        <Box
          key={actionIndicator.seq}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            color: "overlayText.primary",
            bgcolor: "rgba(0,0,0,0.5)",
            borderRadius: "50%",
            width: 80,
            height: 80,
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 5,
            animation: "action-fade 600ms ease-out forwards",
            "@keyframes action-fade": {
              "0%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
              "100%": { opacity: 0, transform: "translate(-50%, -50%) scale(1.3)" },
            },
          }}
        >
          {actionIndicator.icon}
          {actionIndicator.label && (
            <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 600 }}>
              {actionIndicator.label}
            </Typography>
          )}
        </Box>
      )}

      {/* Controls Overlay */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: showControls ? 1 : 0,
          transition: "opacity 300ms",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        {/* Top Bar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, p: { xs: 1, md: 2 }, background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: "overlayText.primary" }}>
            <ChevronLeft size={28} />
          </IconButton>
          {movieData?.content_rating && (
            <Box sx={{ opacity: showBadge ? 1 : 0, transition: "opacity 500ms" }}>
              <ContentRatingBadge rating={movieData.content_rating} size={32} />
            </Box>
          )}
        </Box>

        {/* Center click zone — handles single click (play/pause) and double click (fullscreen) */}
        <Box
          sx={{ flex: 1, cursor: "default" }}
          onClick={() => {
            if (clickTimerRef.current) {
              clearTimeout(clickTimerRef.current);
              clickTimerRef.current = null;
              toggleFullscreen();
            } else {
              clickTimerRef.current = setTimeout(() => {
                clickTimerRef.current = null;
                togglePlay();
              }, 250);
            }
          }}
        >
          {/* Center Play Button (when paused and ready) */}
          {!playing && hlsReady && (
            <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
              <IconButton
                sx={{
                  width: 72,
                  height: 72,
                  bgcolor: "rgba(232,146,111,0.9)",
                  color: "background.default",
                  pointerEvents: "none",
                }}
              >
                <Play size={36} fill="var(--mui-palette-background-default)" />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Bottom Controls */}
        <Box sx={{ px: { xs: 1.5, md: 5 }, pb: { xs: 1.5, md: 3 }, pt: 6, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
          {/* Title and remaining time above seek bar */}
          <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", mb: 0.75, gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overlayTitle" color="overlayText.primary" noWrap>
                {heading.title}
              </Typography>
              {heading.subtitle && (
                <Typography
                  variant="overlaySubtitle"
                  color="overlayText.secondary"
                  noWrap
                  sx={{ mt: 0.25 }}
                >
                  {heading.subtitle}
                </Typography>
              )}
            </Box>
            <Typography
              variant="overlayTimestamp"
              color="overlayText.secondary"
              sx={{ whiteSpace: "nowrap" }}
            >
              {displayDuration > 0 ? `${formatTime(currentTime)} / -${formatTime(Math.max(0, displayDuration - currentTime))}` : ""}
            </Typography>
          </Box>

          {/* Seek Bar — the buffer indicator is painted directly on
              the MUI Slider rail via a gradient background so it
              stays pixel-aligned with the track and thumb. The
              gradient transitions from the buffer color (brighter
              gray) to the unloaded rail color at the buffered
              percentage, creating the same two-tone fill YouTube
              and Netflix use. */}
          <Slider
            value={currentTime}
            max={displayDuration || 1}
            onChange={(_, v) => seek(v as number)}
            sx={{
              color: "primary.main",
              height: { xs: 3, md: 4 },
              p: 0,
              mb: { xs: 0.5, md: 1 },
              "& .MuiSlider-thumb": {
                width: { xs: 16, md: 14 },
                height: { xs: 16, md: 14 },
                transition: "0.1s",
                "&:hover": { width: 18, height: 18 },
              },
              "& .MuiSlider-rail": {
                background: displayDuration > 0
                  ? `linear-gradient(to right, rgba(255,255,255,0.35) ${(bufferedEnd / displayDuration) * 100}%, rgba(255,255,255,0.15) ${(bufferedEnd / displayDuration) * 100}%)`
                  : "rgba(255,255,255,0.15)",
                opacity: 1,
              },
            }}
          />

          {/* Controls Row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, md: 0.5 } }}>
            <IconButton onClick={() => skip(-10)} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
              <SkipBack size={20} />
            </IconButton>
            <IconButton onClick={togglePlay} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
              {playing ? <Pause size={24} /> : <Play size={24} fill="var(--mui-palette-overlayText-primary)" />}
            </IconButton>
            <IconButton onClick={() => skip(30)} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
              <SkipForward size={20} />
            </IconButton>

            <IconButton
              onClick={() => { const m = !muted; setMuted(m); if (videoRef.current) videoRef.current.muted = m; }}
              sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}
            >
              {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </IconButton>
            {/* Volume slider — desktop only */}
            <Slider
              value={muted ? 0 : volume}
              max={1}
              step={0.05}
              onChange={changeVolume}
              sx={{
                width: 80,
                color: "overlayText.primary",
                mx: 1,
                display: { xs: "none", md: "block" },
                "& .MuiSlider-thumb": { width: 12, height: 12 },
                "& .MuiSlider-rail": { bgcolor: "rgba(255,255,255,0.3)" },
              }}
            />

            <Box sx={{ flexGrow: 1 }} />

            {!isMovie && seriesData && (
              <IconButton
                onClick={() => setEpisodeDrawerOpen((v) => !v)}
                sx={{ color: episodeDrawerOpen ? "primary.main" : "overlayText.primary", p: { xs: 1, md: 0.75 } }}
              >
                <LayoutList size={20} />
              </IconButton>
            )}
            <IconButton onClick={openSettings} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
              <Settings size={20} />
            </IconButton>
            {audioTracks.length > 1 && (
              <IconButton onClick={openAudio} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
                <AudioLines size={20} />
              </IconButton>
            )}
            {subtitleTracks.length > 0 && (
              <IconButton
                onClick={openSubtitles}
                sx={{ color: subtitlesActive ? "primary.main" : "overlayText.primary", p: { xs: 1, md: 0.75 } }}
              >
                <Subtitles size={20} />
              </IconButton>
            )}
            <IconButton onClick={toggleFullscreen} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Next Episode Overlay */}
      {nextEpCountdown !== null && nextEpisode && (
        <Box
          sx={{
            position: "absolute",
            bottom: { xs: 80, md: 120 },
            right: { xs: 16, md: 48 },
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            bgcolor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            borderRadius: 2,
            p: { xs: 1.5, md: 2 },
            zIndex: 10,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
              {t("player.nextEpisodeIn", { seconds: nextEpCountdown })}
            </Typography>
            <Typography variant="body2" color="overlayText.primary" fontWeight={600} noWrap>
              {nextEpisode.title}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={cancelNextEpisode}
            sx={{
              color: "text.secondary",
              borderColor: "rgba(255,255,255,0.3)",
              "&:hover": { borderColor: "rgba(255,255,255,0.5)" },
              minWidth: 0,
              px: 1.5,
            }}
          >
            {t("player.cancel")}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={goToNextEpisode}
            startIcon={<SkipForward size={14} />}
            sx={{
              minWidth: 0,
              px: 1.5,
              position: "relative",
              overflow: "hidden",
              zIndex: 0,
              // The progress fill is driven by the JS countdown
              // state so it stays in sync even if the browser
              // throttles the tab (background). The `transition`
              // smooths each 1-second step instead of jumping.
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(255,255,255,0.2)",
                transformOrigin: "left",
                transform: `scaleX(${1 - (nextEpCountdown ?? 10) / 10})`,
                transition: "transform 1s linear",
                zIndex: -1,
              },
            }}
          >
            {t("player.nextEpisode")}
          </Button>
        </Box>
      )}

      {/* Episode Drawer */}
      {episodeDrawerOpen && !isMovie && seriesData && (
        <EpisodeDrawer
          series={seriesData}
          currentSeason={seasonNum}
          currentEpisode={episodeNum}
          onSelect={(s, e) => {
            setEpisodeDrawerOpen(false);
            if (s !== seasonNum || e !== episodeNum) {
              saveCurrentProgress();
              navigate(`/play/episode/${params.seriesId}/${s}/${e}`, { replace: true });
            }
          }}
          onClose={() => setEpisodeDrawerOpen(false)}
        />
      )}

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => { setSettingsAnchor(null); setSettingsPanel("main"); }}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        container={containerEl}
        slotProps={{ paper: { sx: { bgcolor: "rgba(28,28,28,0.95)", backdropFilter: "blur(8px)", minWidth: 220, borderRadius: 2 } } }}
      >
        {settingsPanel === "main" && [
          ...(qualities.length > 0
            ? [
                <MenuItem key="quality" onClick={() => setSettingsPanel("quality")}>
                  <ListItemText primary={t("player.quality")} />
                  <Typography variant="body2" color="text.secondary">{quality}</Typography>
                </MenuItem>,
              ]
            : []),
          <MenuItem key="speed" onClick={() => setSettingsPanel("speed")}>
            <ListItemText primary={t("player.speed")} />
            <Typography variant="body2" color="text.secondary">{speed === 1 ? t("player.normal") : `${speed}x`}</Typography>
          </MenuItem>,
        ]}

        {settingsPanel === "quality" && [
          <SettingsBackItem key="back" label={t("player.quality")} onClick={() => setSettingsPanel("main")} />,
          ...qualities.map((q) => (
            <MenuItem key={q} onClick={() => { setQualityOverride(q); setSettingsPanel("main"); }}>
              {quality === q && <ListItemIcon><Check size={16} color="var(--mui-palette-primary-main)" /></ListItemIcon>}
              <ListItemText inset={quality !== q} primary={q} />
            </MenuItem>
          )),
        ]}

        {settingsPanel === "speed" && [
          <SettingsBackItem key="back" label={t("player.speed")} onClick={() => setSettingsPanel("main")} />,
          ...SPEEDS.map((s) => (
            <MenuItem key={s} onClick={() => changeSpeed(s)}>
              {speed === s && <ListItemIcon><Check size={16} color="var(--mui-palette-primary-main)" /></ListItemIcon>}
              <ListItemText inset={speed !== s} primary={s === 1 ? t("player.normal") : `${s}x`} />
            </MenuItem>
          )),
        ]}
      </Menu>

      {/* Audio Menu */}
      <Menu
        anchorEl={audioAnchor}
        open={Boolean(audioAnchor)}
        onClose={() => setAudioAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        container={containerEl}
        slotProps={{ paper: { sx: { bgcolor: "rgba(28,28,28,0.95)", backdropFilter: "blur(8px)", minWidth: 200, borderRadius: 2 } } }}
      >
        {audioTracks.map((track) => (
          <MenuItem key={track.id} onClick={() => changeAudioTrack(track.id)}>
            {currentAudioTrack === track.id && <ListItemIcon><Check size={16} color="var(--mui-palette-primary-main)" /></ListItemIcon>}
            <ListItemText inset={currentAudioTrack !== track.id} primary={track.name} />
          </MenuItem>
        ))}
      </Menu>

      {/* Subtitle Menu */}
      <Menu
        anchorEl={subtitleAnchor}
        open={Boolean(subtitleAnchor)}
        onClose={() => setSubtitleAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        container={containerEl}
        slotProps={{ paper: { sx: { bgcolor: "rgba(28,28,28,0.95)", backdropFilter: "blur(8px)", minWidth: 200, borderRadius: 2 } } }}
      >
        <MenuItem onClick={() => changeSubtitleTrack(-1)}>
          {currentSubtitleTrack === -1 && <ListItemIcon><Check size={16} color="var(--mui-palette-primary-main)" /></ListItemIcon>}
          <ListItemText inset={currentSubtitleTrack !== -1} primary={t("player.off")} />
        </MenuItem>
        {subtitleTracks.map((track) => (
          <MenuItem key={track.id} onClick={() => changeSubtitleTrack(track.id)}>
            {currentSubtitleTrack === track.id && <ListItemIcon><Check size={16} color="var(--mui-palette-primary-main)" /></ListItemIcon>}
            <ListItemText inset={currentSubtitleTrack !== track.id} primary={track.name} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

function SettingsBackItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <MenuItem onClick={onClick}>
      <ListItemIcon sx={{ color: "overlayText.primary" }}>
        <ChevronLeft size={16} />
      </ListItemIcon>
      <ListItemText primary={label} />
    </MenuItem>
  );
}

