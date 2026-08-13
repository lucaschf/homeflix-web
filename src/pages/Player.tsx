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
import {
  useFileTracks,
  useMovie,
  useProgress,
  useSaveProgress,
  useSeriesDetail,
} from "../api/hooks";
import type { FileAudioTrack, FileSubtitleTrack, FileTrackVersion } from "../api/types";
import { ContentRatingBadge } from "../components/ContentRatingBadge";
import { EpisodeDrawer } from "../components/EpisodeDrawer";
import { PostPlayPanel, type PostPlayHero } from "../components/PostPlayPanel";
import { TitleLogo } from "../components/TitleLogo";
import { usePlaybackPreferences } from "../hooks/usePlaybackPreferences";
import { useMovieUpNext, useSeriesUpNext, type UpNextItem } from "../hooks/useUpNext";
import {
  findFrame,
  useScrubThumbnails,
  type ScrubFrame,
} from "../hooks/useScrubThumbnails";
import { neutral, peach } from "../theme/colors";
import { menuScrim, peachAlpha, scrim, whiteAlpha } from "../theme/tokens";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// How long before the end the post-play panel is assumed to be due when
// the title carries no detected credits marker. Only used to prefetch
// suggestions early — without a marker the panel itself waits for the
// native ``ended`` event, so an overshoot costs nothing but a request.
const NO_MARKER_ONSET_SECONDS = 60;

// Lead time on that estimate for the suggestion queries, so the panel
// opens already populated rather than on a spinner.
const UP_NEXT_PREFETCH_SECONDS = 45;

// Post-play stage geometry. The picture is scaled down and pushed
// aside; the end-of-title caption is a *sibling* of that transform (it
// must not inherit the scale, or its text would render at 46% size and
// turn to mush), so it has to reproduce the same rectangle by hand.
// Both read from these constants — change one and the other follows.
const STAGE_SCALE = 0.46;
/** Horizontal shift on desktop, as a fraction of the viewport. */
const STAGE_SHIFT_X = 0.25;
/** Vertical shift on phones, where the stage moves up instead. */
const STAGE_SHIFT_Y = 0.3;

/** Viewport-percentage rect the shrunken picture occupies. */
const STAGE_RECT = {
  md: {
    left: `${(0.5 - STAGE_SHIFT_X - STAGE_SCALE / 2) * 100}%`,
    top: `${(0.5 - STAGE_SCALE / 2) * 100}%`,
  },
  xs: {
    left: `${(0.5 - STAGE_SCALE / 2) * 100}%`,
    top: `${(0.5 - STAGE_SHIFT_Y - STAGE_SCALE / 2) * 100}%`,
  },
  size: `${STAGE_SCALE * 100}%`,
} as const;

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
  /** Rendition playlist URL — carries the ``audio_{index}`` ordinal we
   * join to the backend ``/tracks`` payload. */
  url?: string;
}

interface HlsSubtitleTrack {
  id: number;
  name: string;
  lang: string;
  /** Rendition playlist URL — carries the ``sub_{index}`` ordinal. */
  url?: string;
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
 * Parse the rendition ordinal from an hls.js media-playlist URL —
 * e.g. ``.../audio_2/playlist.m3u8`` → ``2``. This is the backend's
 * per-file track ``index``, so it joins an hls.js rendition to its
 * ``/tracks`` entry.
 */
function renditionIndex(url: string | undefined, prefix: "audio" | "sub"): number | null {
  if (!url) return null;
  const match = url.match(new RegExp(`${prefix}_(\\d+)/`));
  return match ? Number(match[1]) : null;
}

/**
 * Localized language name for a track code (e.g. ``pt`` → "Português"
 * / "Portuguese"), falling back to the uppercased code when ``Intl``
 * has no name for it. Returns ``""`` for an empty/unknown code.
 */
function localizedLanguage(code: string, locale: string): string {
  const norm = normalizeLang(code);
  if (!norm) return "";
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(norm);
    if (name && name.toLowerCase() !== norm) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {
    // Intl doesn't recognise the code — fall through to the raw code.
  }
  return norm.toUpperCase();
}

/**
 * Correlate a `/tracks` entry to its hls.js rendition and return the
 * rendition's hls.js ``id`` (or ``null`` when this manifest carries no
 * matching rendition). The join mirrors the menu-label composition:
 * first by the ``audio_{index}`` / ``sub_{index}`` ordinal parsed from
 * the rendition URL, then by a same-language match — which also covers
 * the muxed primary audio, whose rendition carries no URL ordinal.
 *
 * The server resolves the *authoritative* default track per-profile and
 * marks it on ``/tracks`` (ADR-026); the player trusts that flag and
 * only needs this to translate the server's ``index`` into the id hls.js
 * expects on ``hls.audioTrack`` / ``hls.subtitleTrack``.
 */
function hlsIdForFileTrack<T extends { id: number; lang?: string; url?: string }>(
  hlsTracks: readonly T[],
  fileIndex: number,
  fileLanguage: string,
  prefix: "audio" | "sub",
): number | null {
  const byOrdinal = hlsTracks.find((t) => renditionIndex(t.url, prefix) === fileIndex);
  if (byOrdinal) return byOrdinal.id;
  const want = normalizeLang(fileLanguage);
  const byLang = want
    ? hlsTracks.find((t) => normalizeLang(t.lang) === want)
    : undefined;
  return byLang?.id ?? null;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Floating thumbnail + timestamp shown above the seek bar while the
 * pointer hovers over it.
 *
 * The component is positioned absolutely against the seek-bar Box so
 * ``hoverX`` lines it up horizontally with the cursor. We clamp the
 * left offset to ``[halfWidth, barWidth - halfWidth]`` so the preview
 * never clips off the screen at either end of the bar. The tile
 * background is rendered with ``background-image`` + ``background-position``
 * / ``-size`` so the single sprite request serves every hover frame
 * without extra network cost.
 */
function ScrubPreview({
  frame,
  time,
  hoverX,
  barWidth,
}: {
  frame: ScrubFrame | null;
  time: number;
  hoverX: number;
  barWidth: number;
}) {
  // No frame available yet (VTT still loading, or we're off the edge of
  // the covered range) — show only the timestamp bubble so the user
  // still gets feedback, and the layout stays stable once the sprite
  // loads partway through hovering.
  const tile = frame ? (
    <Box
      sx={{
        width: frame.width,
        height: frame.height,
        backgroundImage: `url("${frame.spriteUrl}")`,
        backgroundPosition: `-${frame.x}px -${frame.y}px`,
        // Keep the intrinsic sprite size so background-position math
        // stays correct regardless of CSS scaling.
        backgroundSize: "auto",
        borderRadius: 1,
        border: `1px solid ${whiteAlpha(0.2)}`,
        boxShadow: `0 4px 12px ${scrim(0.5)}`,
      }}
    />
  ) : null;

  const previewWidth = frame?.width ?? 96;
  const halfWidth = previewWidth / 2;
  const clampedLeft =
    barWidth > 0
      ? Math.max(halfWidth, Math.min(barWidth - halfWidth, hoverX))
      : hoverX;

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: "100%",
        left: clampedLeft,
        transform: "translateX(-50%)",
        mb: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        pointerEvents: "none",
      }}
    >
      {tile}
      <Typography
        variant="overlayTimestamp"
        sx={{
          color: "overlayText.primary",
          bgcolor: scrim(0.7),
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
          whiteSpace: "nowrap",
        }}
      >
        {formatTime(time)}
      </Typography>
    </Box>
  );
}

// Persisted player preferences. Stored in localStorage under the
// `homeflix.player.*` namespace so future preferences (default playback
// speed, default subtitle language, etc.) can share the same prefix.
const VOLUME_STORAGE_KEY = "homeflix.player.volume";
const MUTED_STORAGE_KEY = "homeflix.player.muted";

// Skip distances for the seek shortcuts (keyboard ←/→ and the
// double-tap edge zones). Forward is longer than backward because
// the dominant use case for forward is skipping past commercials /
// recaps; backward tends to be "I missed a line, jump a beat".
const BACKWARD_SEEK_SECONDS = 10;
const FORWARD_SEEK_SECONDS = 30;

// Granularity (in source-time seconds) of the resume-offset bucket.
// Must mirror ``_RESUME_BUCKET_SECONDS`` on the backend so a saved
// position lands in the same on-disk cache the next session.
const RESUME_BUCKET_SECONDS = 300;
// Source-time floor below which we never bother with a non-zero
// bucket. Resumes inside the first minute are indistinguishable
// from a fresh play and avoid burning a separate cache bucket.
const RESUME_BUCKET_FLOOR_SECONDS = 60;
// Window inside which a second tap on the same edge zone counts as
// a double-tap (and triggers the seek instead of play/pause). Mirrors
// the existing center-zone single-vs-double timing so all three zones
// feel the same.
const DOUBLE_TAP_WINDOW_MS = 250;

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
  const { t, i18n } = useTranslation();
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

  // Per-file track metadata (language + structured dub/version label).
  // Joined to the hls.js renditions below to build localized menu labels.
  const { data: fileTracks } = useFileTracks({
    isMovie,
    movieId: params.movieId,
    seriesId: params.seriesId,
    season: params.season,
    episode: params.episode,
  });
  const { data: savedProgress, isPending: progressPending } = useProgress(mediaId);
  const mediaLoading = isMovie ? movieLoading : seriesLoading;

  // User-level playback preferences from localStorage. The Player
  // reads most prefs (audio/sub/quality) and writes back `speed`
  // when the user changes it so the choice survives across episodes
  // and navigation.
  const [playbackPrefs, setPlaybackPrefs] = usePlaybackPreferences();

  // Wait for media metadata AND the saved-progress query before
  // mounting HLS. ``progressPending`` matters because the URL pins
  // a resume-offset bucket: starting HLS with bucket=0 and then
  // rebuilding once savedProgress resolves would spawn two ffmpeg
  // sessions back-to-back for every resume.
  const isLoading = mediaLoading;

  // Bucket-start (source-time seconds) for the active HLS session.
  // Initialised from ``savedProgress.position_seconds`` rounded down
  // to ``RESUME_BUCKET_SECONDS`` so adjacent resume positions share
  // an encode. User-initiated far seeks update this through
  // ``seekTo`` which triggers a fresh HLS mount.
  const [bucketStart, setBucketStart] = useState(0);
  const initialBucketComputedForMediaIdRef = useRef<string | null>(null);

  // Determine HLS playlist URL. ``start`` query is dropped when the
  // bucket is zero so existing single-bucket caches (and the
  // backend's legacy hash) keep being addressable byte-for-byte.
  const startQuery = bucketStart > 0 ? `?start=${bucketStart}` : "";
  const hlsUrl = isLoading || progressPending
    ? ""
    : isMovie
      ? `/api/v1/stream/movie/${params.movieId}/hls/playlist.m3u8${startQuery}`
      : `/api/v1/stream/episode/${params.seriesId}/${params.season}/${params.episode}/hls/playlist.m3u8${startQuery}`;

  const seasonNum = isMovie ? 0 : Number(params.season);
  const episodeNum = isMovie ? 0 : Number(params.episode);

  // Find the current episode entity (used for duration + intro marker
  // lookup). Memoised so the derived overlays do not re-run on every
  // render of the player when seriesData / params are stable.
  const currentEpisode = useMemo(() => {
    if (isMovie || !seriesData) return null;
    const season = seriesData.seasons.find((s) => s.season_number === seasonNum);
    return season?.episodes.find((e) => e.episode_number === episodeNum) ?? null;
  }, [isMovie, seriesData, seasonNum, episodeNum]);

  const episodeDuration = currentEpisode?.duration_seconds ?? 0;
  const currentIntro = currentEpisode?.intro ?? null;
  // End-credits onset — episode marker for series, movie marker for films.
  const currentCredits = isMovie ? (movieData?.credits ?? null) : (currentEpisode?.credits ?? null);

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
  // Scrub-preview VTT URL — id-based so it's deterministic from the
  // route. The backend serves the WebVTT and its sibling sprite.jpg
  // under the same path prefix, so the cue's relative ``sprite.jpg``
  // reference resolves against this URL automatically. The endpoint
  // 404s until ``ThumbnailBackfillJob`` produces the sprite; the hook
  // retries silently and the seek bar simply renders without previews
  // in the meantime.
  const thumbnailsVttUrl = useMemo(() => {
    if (isLoading) return "";
    return isMovie
      ? `/api/v1/stream/movie/${params.movieId}/scrub-preview/sprite.vtt`
      : `/api/v1/stream/episode/${params.seriesId}/${params.season}/${params.episode}/scrub-preview/sprite.vtt`;
  }, [isLoading, isMovie, params.movieId, params.seriesId, params.season, params.episode]);
  // Seek-bar hover state drives the preview popover below the slider.
  // ``null`` means the cursor isn't over the bar so we skip the render
  // entirely instead of toggling opacity — avoids paying for a
  // background-image swap while the user is scrubbing a different
  // control, and prevents accidental previews when an overlay menu
  // is open above the seek bar.
  const [scrubHover, setScrubHover] = useState<{ time: number; x: number } | null>(null);
  const [seekBarEl, setSeekBarEl] = useState<HTMLDivElement | null>(null);
  const scrubFrames = useScrubThumbnails(thumbnailsVttUrl);
  // Holds the mediaId whose audio/subtitle selection has already been
  // restored from savedProgress, so the restore effect runs again the first
  // time `mediaId` changes (e.g. on auto-advance to the next episode). A
  // simple boolean would lock after the first episode and silently skip
  // restoring tracks for every episode after that.
  const progressRestoredForMediaIdRef = useRef<string | null>(null);
  // Sibling of the restore ref, keyed the same way, for the separate
  // server-default track selection effect (applied once `/tracks` loads).
  const defaultsAppliedForMediaIdRef = useRef<string | null>(null);
  // The audio/subtitle track the player *wants* to be on. A far seek or
  // Skip Intro rebuilds the Hls instance (``hlsUrl`` gets a new
  // ``?start=``), which resets hls.js back to the manifest default — the
  // muxed primary audio. Without re-applying, a dubbed/preferred track
  // drops to the original language on every seek. The
  // ``*_TRACKS_UPDATED`` handlers re-apply these on each manifest parse.
  // ``null`` means "no committed choice yet" — let the selection effects
  // decide on first play. Audio: an hls.js track id; subtitle: an id or
  // ``-1`` (off).
  const desiredAudioTrackRef = useRef<number | null>(null);
  const desiredSubtitleTrackRef = useRef<number | null>(null);
  // Source-time seconds the next HLS mount should land on after the
  // bucket-start changes (user-initiated far seek). Read from the
  // ``hlsReady`` effect, which translates it into the bucket-local
  // ``video.currentTime`` once the new manifest is live. Distinct
  // from the savedProgress restore path so audio/subtitle selections
  // the user made mid-session don't get clobbered by the remount.
  const pendingBucketSeekRef = useRef<number | null>(null);
  // Mirrors ``bucketStart`` for use inside event listeners that close
  // over a stale render's value. Updated via a layout effect below.
  const bucketStartRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Distinct refs per edge zone so a tap on the left followed by a
  // tap on the right within the double-tap window doesn't get
  // misread as a same-zone double-tap.
  const leftTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // VLC-style track OSD — a line of text pinned to the top-right corner
  // when the audio/subtitle track is cycled (e.g. "Audio track:
  // Português"). Distinct from the centered `actionIndicator` because it
  // reads as VLC's on-screen-display: it lingers a little longer and
  // stays out of the picture. `null` = nothing to show.
  // A monotonic `seq` (kept in state, not a ref, so it's safe to read in
  // render as the animation-restart `key`) re-mounts the OSD on each
  // trigger so the fade replays even when the text is unchanged.
  const [trackOsd, setTrackOsd] = useState<{ seq: number; text: string } | null>(null);
  const trackOsdSeqRef = useRef(0);
  const trackOsdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTrackOsd = useCallback((text: string) => {
    if (trackOsdTimerRef.current) clearTimeout(trackOsdTimerRef.current);
    trackOsdSeqRef.current += 1;
    setTrackOsd({ seq: trackOsdSeqRef.current, text });
    trackOsdTimerRef.current = setTimeout(() => setTrackOsd(null), 1500);
  }, []);

  const [playing, setPlaying] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [nextEpCountdown, setNextEpCountdown] = useState<number | null>(null);
  // Post-play surface: the video shrinks aside and a suggestion panel
  // takes over. Raised for movies and for the last episode of a series —
  // anything with a next episode keeps the existing countdown overlay.
  const [postPlayActive, setPostPlayActive] = useState(false);
  // Whether playback has actually reached the end (as opposed to the
  // credits merely having started). Only changes the panel's copy, but
  // it also decides whether "back to the movie" is still meaningful.
  const [postPlayEnded, setPostPlayEnded] = useState(false);
  // Fires the credits trigger at most once per playback; reset when the
  // media changes.
  const creditsHandledRef = useRef(false);
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // The furthest buffered position in source-time seconds. Updated on
  // the `progress` event so the seek bar can show a secondary fill
  // representing the already-downloaded portion of the stream.
  const [bufferedEnd, setBufferedEnd] = useState(0);

  // Keep ``bucketStartRef`` aligned with the latest ``bucketStart`` so
  // long-lived event listeners (timeupdate / progress / save) read the
  // value that's actually in effect for the running HLS session.
  useEffect(() => {
    bucketStartRef.current = bucketStart;
  }, [bucketStart]);

  // Pick the initial bucket for the active mediaId from savedProgress.
  // Guarded by a mediaId-keyed ref so it runs once per session and
  // re-fires on auto-advance. Resumes under the bucket floor stay at
  // zero so a quick "user paused 30s in" doesn't burn a separate
  // cache bucket for a trivial offset. The setState in this effect is
  // a legitimate "sync React state to an external query" pattern (the
  // resume position arrives via React Query, not via rendering), so
  // the set-state-in-effect lint is silenced for this one site.
  useEffect(() => {
    if (progressPending) return;
    if (initialBucketComputedForMediaIdRef.current === mediaId) return;
    initialBucketComputedForMediaIdRef.current = mediaId;
    const saved = savedProgress?.position_seconds ?? 0;
    if (
      !savedProgress ||
      savedProgress.status === "completed" ||
      saved < RESUME_BUCKET_FLOOR_SECONDS
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBucketStart(0);
      return;
    }
    setBucketStart(Math.floor(saved / RESUME_BUCKET_SECONDS) * RESUME_BUCKET_SECONDS);
  }, [progressPending, savedProgress, mediaId]);
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

  // Compose the menu label for each hls.js rendition from the backend
  // ``/tracks`` metadata: localized language + a structured version
  // (dub studio, channel layout, ordinal, or SDH). The join is by the
  // ``audio_{index}`` / ``sub_{index}`` ordinal parsed from the
  // rendition URL, falling back to a same-language match, then to the
  // cleaned raw name while ``/tracks`` is still loading.
  const versionSuffix = useCallback(
    (version: FileTrackVersion | null | undefined): string | null => {
      if (!version) return null;
      switch (version.kind) {
        case "ordinal":
          return t("player.version", { n: version.value });
        case "sdh":
          return t("player.sdh");
        default:
          return version.value;
      }
    },
    [t],
  );

  const audioTrackItems = useMemo(() => {
    const byIndex = new Map<number, FileAudioTrack>();
    fileTracks?.audio_tracks.forEach((a) => byIndex.set(a.index, a));
    return audioTracks.map((track) => {
      const idx = renditionIndex(track.url, "audio");
      const ft =
        (idx != null ? byIndex.get(idx) : undefined) ??
        fileTracks?.audio_tracks.find(
          (a) => normalizeLang(a.language) === normalizeLang(track.lang),
        );
      const base = localizedLanguage(ft?.language ?? track.lang, i18n.language);
      if (!base) return { ...track, label: track.name };
      const suffix = versionSuffix(ft?.version);
      return { ...track, label: suffix ? `${base} · ${suffix}` : base };
    });
  }, [audioTracks, fileTracks, i18n.language, versionSuffix]);

  const subtitleTrackItems = useMemo(() => {
    const byIndex = new Map<number, FileSubtitleTrack>();
    fileTracks?.subtitle_tracks.forEach((s) => byIndex.set(s.index, s));
    return subtitleTracks.map((track) => {
      const idx = renditionIndex(track.url, "sub");
      const ft =
        (idx != null ? byIndex.get(idx) : undefined) ??
        fileTracks?.subtitle_tracks.find(
          (s) => normalizeLang(s.language) === normalizeLang(track.lang),
        );
      const base = localizedLanguage(ft?.language ?? track.lang, i18n.language);
      if (!base) return { ...track, label: track.name };
      const parts = [base];
      const suffix = versionSuffix(ft?.version);
      if (suffix) parts.push(suffix);
      // The server reports forced status from the source (ffprobe), so
      // the label is now reliable — no more reading hls.js's undocumented
      // `forced` flag.
      if (ft?.is_forced) parts.push(t("player.forced"));
      return { ...track, label: parts.join(" · ") };
    });
  }, [subtitleTracks, fileTracks, i18n.language, versionSuffix, t]);

  // Use metadata duration as authoritative source (movie or episode).
  // The backend's HLS bucket covers the full source now, so the <video>
  // element's own ``duration`` matches the API metadata once loaded —
  // we keep the metadata fallback for the brief window where HLS is
  // still fetching the manifest.
  const knownDuration = isMovie ? (movieData?.duration_seconds ?? 0) : episodeDuration;
  const displayDuration = knownDuration > 0 ? knownDuration : duration;

  // Where the post-play panel is expected to appear: the detected
  // credits onset, or a minute before the end when the title has no
  // marker (nothing has scanned it yet, or detection found nothing).
  const postPlayOnset = currentCredits
    ? currentCredits.start_seconds
    : displayDuration > 0
      ? displayDuration - NO_MARKER_ONSET_SECONDS
      : 0;

  // Suggestions are fetched a little before the panel is due so it
  // renders populated instead of spinning. Series that still have an
  // episode ahead never arm — they hand off to the next-episode
  // countdown and never show this panel.
  const upNextArmed =
    (isMovie || !nextEpisode) &&
    (postPlayActive ||
      (hlsReady && postPlayOnset > 0 && currentTime >= postPlayOnset - UP_NEXT_PREFETCH_SECONDS));

  const movieUpNext = useMovieUpNext({
    movieId: params.movieId ?? "",
    enabled: isMovie && upNextArmed && !!params.movieId,
    collectionTmdbId: movieData?.collection?.tmdb_id ?? null,
    genres: movieData?.genres,
    year: movieData?.year ?? null,
  });
  const seriesUpNext = useSeriesUpNext({
    seriesId: params.seriesId ?? "",
    enabled: !isMovie && upNextArmed && !!params.seriesId,
    genres: seriesData?.genres,
  });
  const upNext = isMovie ? movieUpNext : seriesUpNext;

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

  // Source-time is inside the intro window. Derived (not state) so it
  // re-evaluates each render and drives the Skip Intro button's
  // visibility directly — the button stays up for the whole window,
  // independent of the controls' auto-hide, so it remains reachable
  // once the chrome fades. Gated on ``hlsReady`` so an intro that
  // starts at t=0 doesn't surface the button during cold start — it
  // appears once playback actually begins.
  const introActive =
    hlsReady &&
    !!currentIntro &&
    currentTime >= currentIntro.start_seconds &&
    currentTime < currentIntro.end_seconds;

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

    // ``video.currentTime`` is bucket-local seconds (the active HLS
    // manifest starts at the bucket offset, not source t=0), so the
    // displayed source-time is ``bucketStart + video.currentTime``.
    // ``bucketStartRef`` is read via ref because the listeners are
    // attached once and must observe the latest bucket without
    // re-binding the listener on every bucket change.
    const onTimeUpdate = () =>
      setCurrentTime(bucketStartRef.current + video.currentTime);
    const onLoadedMetadata = () => {
      if (!knownDuration) setDuration(bucketStartRef.current + video.duration);
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
    // the furthest buffered end and translate it from bucket-local
    // time to source-time so the seek bar paints the downloaded
    // portion on the same scale as the seek handle.
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBufferedEnd(
          bucketStartRef.current + video.buffered.end(video.buffered.length - 1),
        );
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
  }, [knownDuration, isLoading]);

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
          url: t.url,
        }));
        setAudioTracks(tracks);
        // Re-apply the committed audio choice across a remount (new Hls
        // instance from a far seek / Skip Intro) so a dubbed track isn't
        // reset to the manifest default. Null = first play; the selection
        // effects will decide and set the desired ref.
        const desired = desiredAudioTrackRef.current;
        if (
          desired != null &&
          desired >= 0 &&
          desired !== hls.audioTrack &&
          hls.audioTracks.some((tk) => tk.id === desired)
        ) {
          hls.audioTrack = desired;
        }
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
          url: t.url,
        }));
        setSubtitleTracks(tracks);
        // Re-apply the committed subtitle choice across a remount (incl.
        // ``-1`` = off, so hls.js can't silently re-enable a manifest
        // default). Null = first play; the selection effects decide.
        const desired = desiredSubtitleTrackRef.current;
        if (
          desired != null &&
          desired !== hls.subtitleTrack &&
          (desired === -1 || hls.subtitleTracks.some((tk) => tk.id === desired))
        ) {
          hls.subtitleTrack = desired;
        }
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

  // Forget the committed track choices when the media itself changes
  // (new movie/episode) so one title's selection doesn't bleed into the
  // next before its own selection resolves. A bucket remount keeps the
  // same mediaId, so the choice deliberately survives seeks / Skip Intro.
  useEffect(() => {
    desiredAudioTrackRef.current = null;
    desiredSubtitleTrackRef.current = null;
  }, [mediaId]);

  // Restore audio/subtitle track selection on first play.
  //
  // Priority order for each track:
  //   1. Saved per-media selection from `savedProgress` (the user
  //      picked a specific track last time they watched this item).
  //   2. Server-resolved per-profile default from `/tracks`
  //      (`is_default`), applied in the sibling effect below once the
  //      query settles — the server owns audio + subtitle-by-mode.
  //   3. HLS default (audio track 0, subtitles off).
  //
  // Resume position is applied HERE too — the backend serves a full
  // playlist from t=0 and the player seeks via ``video.currentTime``
  // once the manifest is ready. This replaces the old ``?start=``
  // URL trick and is what makes seeking backwards past the saved
  // position work naturally.
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

    // ── Position ────────────────────────────────────────────
    // Translate the source-time save into bucket-local time before
    // seeking, since ``video.currentTime`` runs on the active
    // manifest's clock (which starts at the bucket offset, not at
    // the source's t=0). With the bucket aligned to or below the
    // saved position, ``saved - bucketStart`` is always >= 0 and
    // typically under one bucket length, so the clamp against
    // ``video.duration`` exists only to protect against a save that
    // landed a few tenths of a second past the manifest's tail.
    //
    // Skip the position write when a user-initiated seek is in flight
    // (``pendingBucketSeekRef`` set by ``seekTo``). Both this effect and
    // the pending-seek applier fire on the same post-remount ``hlsReady``
    // flip; without this guard the saved position would clobber the seek
    // target — e.g. clicking Skip Intro during the cold-start window,
    // before the first restore had run, snapped the playhead backwards.
    // Audio/subtitle restoration below still runs.
    if (
      savedProgress &&
      savedProgress.status !== "completed" &&
      pendingBucketSeekRef.current === null
    ) {
      const saved = Math.max(0, Math.floor(savedProgress.position_seconds));
      const bucketLocal = Math.max(0, saved - bucketStart);
      const upperBound = Number.isFinite(video.duration)
        ? Math.max(0, video.duration - 1)
        : bucketLocal;
      const target = Math.min(bucketLocal, upperBound);
      if (target > 0 && Math.abs(video.currentTime - target) > 0.5) {
        video.currentTime = target;
      }
    }

    // ── Audio / Subtitles (saved selections only) ───────────
    // Restore the exact tracks the viewer last used on this media.
    // The *default* selection — when there's nothing saved — is applied
    // separately below, once `/tracks` resolves, because the server owns
    // that choice now (ADR-026). Setting hls.audioTrack on HLS.js — even
    // to the value it already is — can trigger a buffer flush of the
    // audio segments (a brief dropout right after start), so compare
    // before assigning.
    const savedAudio = savedProgress?.audio_track;
    if (savedAudio != null && savedAudio !== 0) {
      desiredAudioTrackRef.current = savedAudio;
      if (hls.audioTrack !== savedAudio) hls.audioTrack = savedAudio;
    }
    const savedSub = savedProgress?.subtitle_track;
    if (savedSub != null && savedSub !== -1) {
      desiredSubtitleTrackRef.current = savedSub;
      if (hls.subtitleTrack !== savedSub) hls.subtitleTrack = savedSub;
    }
  }, [savedProgress, progressPending, hlsReady, mediaId, bucketStart]);

  // Apply the server-resolved default audio/subtitle once `/tracks`
  // resolves, when the viewer has no saved selection to restore. The
  // server marks exactly one (or zero) default per list, per-profile and
  // by subtitle mode — off / always / foreignOnly / forcedOnly, incl.
  // auto-forced (ADR-026). We translate its ``index`` to the hls.js id
  // and commit it. Kept separate from the resume restore above so a slow
  // (or failed) `/tracks` never delays the position seek.
  useEffect(() => {
    if (progressPending) return;
    if (!hlsReady) return;
    const hls = hlsRef.current;
    if (!hls || !fileTracks) return;
    if (defaultsAppliedForMediaIdRef.current === mediaId) return;
    defaultsAppliedForMediaIdRef.current = mediaId;

    const savedAudio = savedProgress?.audio_track;
    if (savedAudio == null || savedAudio === 0) {
      const preferred = fileTracks.audio_tracks.find((a) => a.is_default);
      const id = preferred
        ? hlsIdForFileTrack(hls.audioTracks, preferred.index, preferred.language, "audio")
        : null;
      if (id != null) {
        desiredAudioTrackRef.current = id;
        if (hls.audioTrack !== id) hls.audioTrack = id;
      }
    }

    const savedSub = savedProgress?.subtitle_track;
    if (savedSub == null || savedSub === -1) {
      const preferred = fileTracks.subtitle_tracks.find((s) => s.is_default);
      const id = preferred
        ? hlsIdForFileTrack(hls.subtitleTracks, preferred.index, preferred.language, "sub")
        : null;
      // No server default → subtitles off. The server owns the mode, so
      // an absent default means "don't auto-enable", not "keep whatever
      // hls.js picked from the manifest". Either way it's a committed
      // choice, so record it (incl. -1) to survive a remount.
      desiredSubtitleTrackRef.current = id ?? -1;
      if (id != null) {
        if (hls.subtitleTrack !== id) hls.subtitleTrack = id;
      } else if (hls.subtitleTrack !== -1) {
        hls.subtitleTrack = -1;
      }
    }
  }, [savedProgress, progressPending, hlsReady, mediaId, fileTracks]);

  // Apply ``pendingBucketSeekRef`` once the user-initiated remount
  // finishes parsing its new manifest. Kept separate from the
  // savedProgress restore above so audio/subtitle choices the user
  // made mid-session don't get reset whenever they jump across a
  // bucket boundary — only the position is overridden here.
  useEffect(() => {
    if (!hlsReady) return;
    if (pendingBucketSeekRef.current === null) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = pendingBucketSeekRef.current;
    pendingBucketSeekRef.current = null;
  }, [hlsReady]);

  // Auto-save progress every 10 seconds during playback. ``playing``
  // is already gated on the video element having fired ``playing``,
  // so the interval only runs once the stream has actual frames —
  // no extra ``readyState`` check needed here.
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || !mediaId) return;
      if (!displayDuration) return;
      saveProgressRef.current({
        media_id: mediaId,
        media_type: mediaType,
        position_seconds: Math.floor(bucketStartRef.current + video.currentTime),
        duration_seconds: Math.floor(displayDuration),
        audio_track: hlsRef.current?.audioTrack,
        subtitle_track: hlsRef.current?.subtitleTrack,
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [playing, mediaId, mediaType, displayDuration]);

  // Save progress on pause or unmount. Gate on
  // ``readyState >= HAVE_CURRENT_DATA`` (=2) so a snappy mount→unmount
  // (user clicks the wrong card, Ctrl+W) that never rendered a frame
  // doesn't overwrite the persisted resume point with 0.
  const saveCurrentProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !mediaId) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!displayDuration || bucketStartRef.current + video.currentTime === 0) return;
    saveProgressRef.current({
      media_id: mediaId,
      media_type: mediaType,
      position_seconds: Math.floor(bucketStartRef.current + video.currentTime),
      duration_seconds: Math.floor(displayDuration),
      audio_track: hlsRef.current?.audioTrack,
      subtitle_track: hlsRef.current?.subtitleTrack,
    });
  }, [mediaId, mediaType, displayDuration]);

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
      if (!video || !mediaId) return;
      // Same ``readyState`` gate as ``saveCurrentProgress`` — a
      // beforeunload that fires while the element is still
      // ``HAVE_NOTHING``/``HAVE_METADATA`` shouldn't overwrite
      // a real saved position with 0.
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (!displayDuration || bucketStartRef.current + video.currentTime === 0) return;
      const body = JSON.stringify({
        media_id: mediaId,
        media_type: mediaType,
        position_seconds: Math.floor(bucketStartRef.current + video.currentTime),
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
  }, [mediaId, mediaType, displayDuration]);

  const seriesDetailPath = params.seriesId ? `/series/${params.seriesId}` : "/";

  const goToNextEpisode = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setNextEpCountdown(null);
    if (nextEpisode) {
      navigate(`/play/episode/${params.seriesId}/${nextEpisode.season}/${nextEpisode.episode}`, { replace: true });
    } else {
      navigate(seriesDetailPath, { replace: true });
    }
  }, [nextEpisode, navigate, params.seriesId, seriesDetailPath]);

  // Source-time seek. A native ``video.currentTime`` nudge is used only
  // when the target is already reachable inside the current manifest —
  // i.e. behind the buffered tail. Anything else (a seek before the
  // current bucket, or a forward jump past what's been transcoded, like
  // Skip Intro on a still-encoding file) remounts a fresh ffmpeg
  // anchored AT the target second.
  //
  // Why not a native forward seek: the transcode is a live/event HLS
  // playlist (no ``#EXT-X-ENDLIST``), so the browser clamps any seek
  // past the live edge and, once the encoder catches up, abandons the
  // pending seek and drops back — exactly the "waited for processing
  // then jumped back" symptom. Mounting a new encode at the target
  // makes its first segment the destination, so playback starts there
  // with no out-of-range seek. This relies on the backend honouring the
  // exact ``?start=`` second (it keys the cache bucket and the ffmpeg
  // ``-ss`` by it). ``pendingBucketSeekRef`` is applied by the
  // dedicated effect on the next ``hlsReady`` once the manifest is live.
  const seekTo = useCallback(
    (displaySourceTime: number) => {
      const video = videoRef.current;
      if (!video) return;
      const upper = displayDuration > 0 ? displayDuration - 1 : Infinity;
      const target = Math.max(0, Math.min(upper, displaySourceTime));
      const bucketLocalTarget = target - bucketStart;
      const bufferedEndLocal =
        video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
      const needsRemount =
        bucketLocalTarget < 0 || bucketLocalTarget > bufferedEndLocal;
      if (needsRemount) {
        const flooredBucket = target < RESUME_BUCKET_FLOOR_SECONDS ? 0 : Math.floor(target);
        // If the floored bucket is the one we're already playing, a
        // ``setBucketStart`` would be a no-op: the manifest never
        // remounts, the ``pendingBucketSeekRef`` below never applies, and
        // the playhead silently stays put (the "Skip Intro doesn't skip /
        // jumps back" bug). This happens for a forward seek past the
        // transcoded edge that still lands in the current bucket — e.g.
        // skipping an intro that ends under ``RESUME_BUCKET_FLOOR_SECONDS``
        // on a cold start (bucketStart 0). Anchor a fresh encode at the
        // exact target second instead so the backend re-runs ffmpeg there.
        const newBucket = flooredBucket === bucketStart ? Math.floor(target) : flooredBucket;
        if (newBucket !== bucketStart) {
          pendingBucketSeekRef.current = Math.max(0, target - newBucket);
          setBucketStart(newBucket);
          setCurrentTime(target);
          return;
        }
        // Remount is genuinely impossible (already anchored at this exact
        // second) — fall through to a native seek; the segment is normally
        // already produced this close to the bucket origin.
      }
      video.currentTime = bucketLocalTarget;
      setCurrentTime(target);
    },
    [bucketStart, displayDuration],
  );

  const skipIntro = useCallback(() => {
    if (!currentIntro) return;
    seekTo(currentIntro.end_seconds);
  }, [currentIntro, seekTo]);

  // ── Post-play actions ────────────────────────────────────

  const detailPath = isMovie ? `/movie/${params.movieId}` : seriesDetailPath;

  /** Put the video back full-screen and let the credits finish. */
  const dismissPostPlay = useCallback(() => setPostPlayActive(false), []);

  /**
   * Restart the title from the top. The credits guard is cleared too,
   * otherwise the panel would never come back on this second viewing.
   */
  const replayFromStart = useCallback(() => {
    creditsHandledRef.current = false;
    setPostPlayActive(false);
    setPostPlayEnded(false);
    seekTo(0);
    videoRef.current?.play().catch(() => {});
  }, [seekTo]);

  /**
   * Open a suggestion. Movies start playing straight away — the click
   * on the card *is* the explicit consent this panel deliberately waits
   * for. Series can't: picking which episode to resume belongs to the
   * detail page, so they route there instead.
   */
  const openSuggestion = useCallback(
    (item: UpNextItem) => {
      saveCurrentProgress();
      navigate(item.mediaType === "movie" ? `/play/movie/${item.id}` : `/series/${item.id}`, {
        replace: true,
      });
    },
    [navigate, saveCurrentProgress],
  );

  // The strongest suggestion is promoted out of the grid into the
  // panel's hero slot — landscape artwork reads better there, and the
  // grid below renders whatever is left.
  const postPlayHero = useMemo<PostPlayHero | null>(() => {
    const top = upNext.items[0];
    if (!top) return null;
    return {
      title: top.title,
      subtitle: top.subtitle,
      synopsis: top.synopsis,
      imageUrl: top.backdropUrl ?? top.posterUrl,
      ctaLabel: t("player.postPlay.play"),
      onPlay: () => openSuggestion(top),
    };
  }, [upNext.items, openSuggestion, t]);

  const cancelNextEpisode = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setNextEpCountdown(null);
  }, []);

  // Start the "next episode in 10s" countdown. Idempotent — bails when a
  // countdown is already running, so the credits trigger and the native
  // ``ended`` event can both call it without double-starting the timer.
  const startNextEpisodeCountdown = useCallback(() => {
    if (!nextEpisode || countdownTimerRef.current) return;
    setNextEpCountdown(10);
    countdownTimerRef.current = setInterval(() => {
      setNextEpCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [nextEpisode]);

  // Mark the title watched by saving progress at (near) its full
  // duration so the backend's completion threshold flips it to
  // ``completed``. Used when the credits trigger fires.
  const markWatched = useCallback(() => {
    const video = videoRef.current;
    if (!video || !mediaId || !displayDuration) return;
    saveProgressRef.current({
      media_id: mediaId,
      media_type: mediaType,
      position_seconds: Math.floor(displayDuration),
      duration_seconds: Math.floor(displayDuration),
      audio_track: hlsRef.current?.audioTrack,
      subtitle_track: hlsRef.current?.subtitleTrack,
    });
  }, [mediaId, mediaType, displayDuration]);

  // Reset the one-shot credits guard + post-play panel whenever the
  // media changes (next episode, different movie).
  useEffect(() => {
    creditsHandledRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPostPlayActive(false);
    setPostPlayEnded(false);
  }, [mediaId]);

  // Credits trigger: once playback passes the detected credits onset,
  // mark the title watched and hand off to whichever end-of-title
  // surface applies — the auto-next countdown when another episode is
  // queued up, otherwise the post-play suggestion panel. Fires once per
  // playback (``creditsHandledRef``). When there is no credits marker
  // this never runs and the native ``ended`` event remains the fallback.
  useEffect(() => {
    if (!currentCredits || creditsHandledRef.current) return;
    if (currentTime < currentCredits.start_seconds) return;
    creditsHandledRef.current = true;
    markWatched();
    if (isMovie || !nextEpisode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPostPlayActive(true);
    } else {
      startNextEpisodeCountdown();
    }
  }, [
    currentTime,
    currentCredits,
    isMovie,
    markWatched,
    nextEpisode,
    startNextEpisodeCountdown,
  ]);

  // End of playback. With another episode queued this starts the
  // countdown (the fallback path when no credits marker fired, or when
  // the credits countdown was cancelled — ``start...`` bails if one is
  // already running). Otherwise the post-play panel takes the screen,
  // which is also what keeps a finished movie from parking the viewer
  // on a frozen black frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnded = () => {
      saveCurrentProgress();
      if (isMovie || !nextEpisode) {
        setPostPlayEnded(true);
        setPostPlayActive(true);
        return;
      }
      startNextEpisodeCountdown();
    };

    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [isMovie, nextEpisode, saveCurrentProgress, startNextEpisodeCountdown]);

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
      if (leftTapTimerRef.current) clearTimeout(leftTapTimerRef.current);
      if (rightTapTimerRef.current) clearTimeout(rightTapTimerRef.current);
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

  // Seek helpers shared by keyboard arrows and the new mobile-style
  // double-tap edge zones below. Wrapped in ``useCallback`` so the
  // keyboard effect can list them as deps without re-binding the
  // listener on every render.
  const seekBackward = useCallback(() => {
    seekTo(currentTime - BACKWARD_SEEK_SECONDS);
    showAction(<SkipBack size={32} />, `-${BACKWARD_SEEK_SECONDS}s`);
    resetHideTimer();
  }, [seekTo, currentTime, showAction, resetHideTimer]);

  const seekForward = useCallback(() => {
    seekTo(currentTime + FORWARD_SEEK_SECONDS);
    showAction(<SkipForward size={32} />, `+${FORWARD_SEEK_SECONDS}s`);
    resetHideTimer();
  }, [seekTo, currentTime, showAction, resetHideTimer]);

  // VLC-style track cycling. Pressing the key advances straight to the
  // next track (and flashes its label) instead of opening a menu —
  // mirroring VLC's `b` (audio) / `v` (subtitle) behaviour. The chosen
  // id is committed to the `desired*` ref so a later seek/remount
  // re-applies it, matching the menu handlers above.
  const cycleAudioTrack = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls || audioTrackItems.length < 2) return;
    const idx = audioTrackItems.findIndex((tk) => tk.id === currentAudioTrack);
    const next = audioTrackItems[(idx + 1) % audioTrackItems.length];
    desiredAudioTrackRef.current = next.id;
    hls.audioTrack = next.id;
    showTrackOsd(`${t("player.audioTrack")}: ${next.label}`);
    resetHideTimer();
  }, [audioTrackItems, currentAudioTrack, showTrackOsd, resetHideTimer, t]);

  const cycleSubtitleTrack = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    // Cycle order: each subtitle track in menu order, then "off" (-1),
    // then back to the first — same set the subtitle menu offers.
    const ids = [...subtitleTrackItems.map((tk) => tk.id), -1];
    if (ids.length < 2) return;
    const idx = ids.indexOf(currentSubtitleTrack);
    const nextId = ids[(idx + 1) % ids.length];
    desiredSubtitleTrackRef.current = nextId;
    hls.subtitleTrack = nextId;
    const label =
      nextId === -1
        ? t("player.off")
        : subtitleTrackItems.find((tk) => tk.id === nextId)?.label ?? "";
    showTrackOsd(`${t("player.subtitleTrack")}: ${label}`);
    resetHideTimer();
  }, [subtitleTrackItems, currentSubtitleTrack, showTrackOsd, resetHideTimer, t]);

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
            showAction(<Play size={36} fill={neutral[50]} />);
          } else {
            video.pause();
            showAction(<Pause size={36} />);
          }
          break;
        case "arrowleft":
          seekBackward();
          break;
        case "arrowright":
          seekForward();
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
        case "b":
          // VLC: cycle audio track.
          cycleAudioTrack();
          break;
        case "v":
          // VLC: cycle subtitle track (… → off → first).
          cycleSubtitleTrack();
          break;
        case "escape":
          // While the post-play panel is up, Escape closes it and
          // returns to the credits rather than leaving the player —
          // the panel is the topmost surface, so it's what the key
          // should dismiss. Once playback has ended there's nothing to
          // return to and the usual exit applies.
          if (postPlayActive && !postPlayEnded) dismissPostPlay();
          else if (isFullscreen) document.exitFullscreen();
          else navigate(-1);
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    containerEl,
    displayDuration,
    dismissPostPlay,
    isFullscreen,
    navigate,
    postPlayActive,
    postPlayEnded,
    resetHideTimer,
    showAction,
    toggleFullscreen,
    seekBackward,
    seekForward,
    cycleAudioTrack,
    cycleSubtitleTrack,
  ]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      showAction(<Play size={36} fill={neutral[50]} />);
    } else {
      video.pause();
      showAction(<Pause size={36} />);
    }
  };

  const seek = (displayValue: number) => seekTo(displayValue);

  const skip = (seconds: number) => {
    seekTo(currentTime + seconds);
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
    // Remember the manual choice so a later seek/remount re-applies it.
    desiredAudioTrackRef.current = trackId;
    hls.audioTrack = trackId;
    setAudioAnchor(null);
  };

  const changeSubtitleTrack = (trackId: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    desiredSubtitleTrackRef.current = trackId;
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

  // Mouse wheel → volume control. Scroll up = louder, down = softer.
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const video = videoRef.current;
      if (!video) return;
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const next = Math.min(1, Math.max(0, volume + delta));
      video.volume = next;
      setVolume(next);
      if (next === 0) {
        setMuted(true);
        video.muted = true;
      } else if (muted) {
        setMuted(false);
        video.muted = false;
      }
      showAction(next === 0 ? <VolumeX size={32} /> : <Volume2 size={32} />, `${Math.round(next * 100)}%`);
      resetHideTimer();
    },
    [volume, muted, resetHideTimer, showAction],
  );

  // Show loading while fetching movie data
  if (isLoading) {
    return (
      <Box sx={{ position: "fixed", inset: 0, bgcolor: "common.black", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const subtitlesActive = currentSubtitleTrack >= 0;

  // Key art for the end-of-title still. A finished HLS stream leaves the
  // element parked on a black frame, which reads as a dead player rather
  // than a finished film — the title's own backdrop fills the stage
  // instead. Only used once playback has actually ended; while the
  // credits roll the moving picture is still the point.
  const endStillUrl = (isMovie ? movieData?.backdrop_path : seriesData?.backdrop_path) ?? null;

  // Metadata line under the logo on that still. Movies get the release
  // year and their headline genres; episodes get the SxxExx line the
  // seek-bar header already composes.
  const endStillCaption = isMovie
    ? [movieData?.year, movieData?.genres?.slice(0, 3).join(" · ")].filter(Boolean).join(" · ")
    : heading.subtitle;

  return (
    <Box
      ref={setContainerEl}
      onMouseMove={resetHideTimer}
      onWheel={handleWheel}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        bgcolor: "common.black",
        // The panel is an affordance the user is meant to point at, so
        // the cursor stays visible while it's up even if the controls
        // have auto-hidden.
        cursor: showControls || postPlayActive ? "default" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Video stage. On post-play the picture scales down and slides
          aside — left column on desktop, top half on phones — so the
          credits keep running next to the suggestion panel instead of
          being replaced by it. The wrapper carries the transform so the
          <video> element itself is never re-mounted (that would tear
          down the HLS session mid-transition). */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          transformOrigin: "center",
          transition: "transform 480ms cubic-bezier(0.4, 0, 0.2, 1)",
          transform: postPlayActive
            ? {
                xs: `translateY(-${STAGE_SHIFT_Y * 100}%) scale(${STAGE_SCALE})`,
                md: `translateX(-${STAGE_SHIFT_X * 100}%) scale(${STAGE_SCALE})`,
              }
            : "none",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <video
          ref={videoRef}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />

        {/* End-of-title still — see ``endStillUrl``. Lives inside the
            transform wrapper so it lands exactly where the picture was,
            and fades in rather than cutting, which would read as a
            glitch right after the last frame. */}
        {postPlayEnded && endStillUrl && (
          <Box
            component="img"
            src={endStillUrl}
            alt=""
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              animation: "postplay-still 800ms ease-out both",
              "@keyframes postplay-still": { from: { opacity: 0 }, to: { opacity: 1 } },
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          />
        )}
      </Box>

      {/* Title block over the end-of-title still. Deliberately a sibling
          of the transform wrapper rather than a child: inheriting the
          0.46 scale would render the caption at roughly 6px. It instead
          reproduces the stage rectangle from the shared constants and
          draws at full size. */}
      {postPlayEnded && (
        <Box
          sx={{
            position: "absolute",
            left: { xs: STAGE_RECT.xs.left, md: STAGE_RECT.md.left },
            top: { xs: STAGE_RECT.xs.top, md: STAGE_RECT.md.top },
            width: STAGE_RECT.size,
            height: STAGE_RECT.size,
            zIndex: 13,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            p: { xs: 2, md: 3 },
            // Foot scrim so the logo reads over a bright backdrop.
            background: `linear-gradient(to top, ${scrim(0.85)} 0%, ${scrim(0.4)} 28%, transparent 58%)`,
            animation: "postplay-caption 800ms ease-out both",
            "@keyframes postplay-caption": { from: { opacity: 0 }, to: { opacity: 1 } },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          <TitleLogo
            logoUrl={isMovie ? movieData?.logo_path : seriesData?.logo_path}
            title={heading.title}
            sx={{ mb: endStillCaption ? 1 : 0 }}
          />
          {endStillCaption && (
            <Typography
              sx={{
                color: "overlayText.secondary",
                fontSize: "0.8125rem",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              {endStillCaption}
            </Typography>
          )}
        </Box>
      )}

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
            bgcolor: hlsReady ? "transparent" : scrim(0.7),
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
            bgcolor: scrim(0.5),
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

      {/* VLC-style track OSD — top-right corner, plain text on a subtle
          scrim, shown briefly when the audio/subtitle track is cycled
          with `b` / `v`. Sits above the controls chrome and never
          intercepts pointer events. */}
      {trackOsd && (
        <Typography
          key={trackOsd.seq}
          sx={{
            position: "absolute",
            top: { xs: 16, md: 24 },
            right: { xs: 16, md: 24 },
            maxWidth: "70%",
            px: { xs: 1.75, md: 2.25 },
            py: { xs: 1, md: 1.25 },
            color: "overlayText.primary",
            bgcolor: scrim(0.5),
            borderRadius: 1.5,
            fontSize: { xs: "1.1rem", md: "1.5rem" },
            lineHeight: 1.2,
            fontWeight: 600,
            textAlign: "right",
            pointerEvents: "none",
            zIndex: 6,
            animation: "track-osd-fade 1500ms ease-out forwards",
            "@keyframes track-osd-fade": {
              "0%": { opacity: 0 },
              "10%": { opacity: 1 },
              "80%": { opacity: 1 },
              "100%": { opacity: 0 },
            },
          }}
        >
          {trackOsd.text}
        </Typography>
      )}

      {/* Center Play Button (when paused and ready). Anchored to the
          container's true center — the same reference as the flashing
          action indicator above — so the two line up exactly. It used
          to live inside the middle click zone, which is centered
          between the top bar and the taller bottom controls and so
          sat higher than the flashing icon. Non-interactive: clicks
          fall through to the zones below. */}
      {!playing && hlsReady && !postPlayActive && (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <IconButton
            sx={{
              width: 72,
              height: 72,
              bgcolor: peachAlpha(0.9),
              color: "background.default",
              pointerEvents: "none",
            }}
          >
            <Play size={36} fill={neutral[950]} />
          </IconButton>
        </Box>
      )}

      {/* Controls Overlay. Suppressed while the post-play panel is up:
          the transport belongs to a full-screen picture, and leaving a
          full-width seek bar under a half-width video reads as a
          leftover. Dismissing the panel brings it straight back. */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: showControls && !postPlayActive ? 1 : 0,
          transition: "opacity 300ms",
          pointerEvents: showControls && !postPlayActive ? "auto" : "none",
        }}
      >
        {/* Click row split into three zones. Single tap in any zone
            toggles play/pause; double tap on the left seeks back, on
            the right seeks forward, and in the center toggles
            fullscreen. The edge double-tap matches the YouTube /
            Netflix mobile gesture so users find it without docs. */}
        <Box sx={{ flex: 1, display: "flex", cursor: "default" }}>
          <Box
            sx={{ flex: 3, touchAction: "manipulation" }}
            onClick={() => {
              if (leftTapTimerRef.current) {
                clearTimeout(leftTapTimerRef.current);
                leftTapTimerRef.current = null;
                seekBackward();
              } else {
                leftTapTimerRef.current = setTimeout(() => {
                  leftTapTimerRef.current = null;
                  togglePlay();
                }, DOUBLE_TAP_WINDOW_MS);
              }
            }}
          />
          <Box
            sx={{ flex: 4, touchAction: "manipulation" }}
            onClick={() => {
              if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
                toggleFullscreen();
              } else {
                clickTimerRef.current = setTimeout(() => {
                  clickTimerRef.current = null;
                  togglePlay();
                }, DOUBLE_TAP_WINDOW_MS);
              }
            }}
          />
          <Box
            sx={{ flex: 3, touchAction: "manipulation" }}
            onClick={() => {
              if (rightTapTimerRef.current) {
                clearTimeout(rightTapTimerRef.current);
                rightTapTimerRef.current = null;
                seekForward();
              } else {
                rightTapTimerRef.current = setTimeout(() => {
                  rightTapTimerRef.current = null;
                  togglePlay();
                }, DOUBLE_TAP_WINDOW_MS);
              }
            }}
          />
        </Box>

        {/* Bottom Controls */}
        <Box sx={{ px: { xs: 1.5, md: 5 }, pb: { xs: 1.5, md: 3 }, pt: 6, background: `linear-gradient(to top, ${scrim(0.8)}, transparent)` }}>
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
              and Netflix use. The wrapping Box captures hover
              coordinates so the scrub-preview thumbnail below can
              be positioned in sync with the cursor. */}
          <Box
            ref={setSeekBarEl}
            onMouseMove={(e) => {
              if (displayDuration <= 0 || scrubFrames.length === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              // Clamp x to the bar width so the preview never drifts
              // past the rail edges on fast pointer moves.
              const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
              const time = (x / rect.width) * displayDuration;
              setScrubHover({ time, x });
            }}
            onMouseLeave={() => setScrubHover(null)}
            sx={{ position: "relative" }}
          >
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
                    ? `linear-gradient(to right, ${whiteAlpha(0.35)} ${(bufferedEnd / displayDuration) * 100}%, ${whiteAlpha(0.15)} ${(bufferedEnd / displayDuration) * 100}%)`
                    : whiteAlpha(0.15),
                  opacity: 1,
                },
              }}
            />
            {scrubHover && (
              <ScrubPreview
                frame={findFrame(scrubFrames, scrubHover.time)}
                time={scrubHover.time}
                hoverX={scrubHover.x}
                barWidth={seekBarEl?.clientWidth ?? 0}
              />
            )}
          </Box>

          {/* Controls Row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, md: 0.5 } }}>
            <IconButton onClick={() => skip(-10)} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
              <SkipBack size={20} />
            </IconButton>
            <IconButton onClick={togglePlay} sx={{ color: "overlayText.primary", p: { xs: 1, md: 0.75 } }}>
              {playing ? <Pause size={24} /> : <Play size={24} fill={neutral[50]} />}
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
                "& .MuiSlider-rail": { bgcolor: whiteAlpha(0.3) },
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

      {/* Top bar. Deliberately NOT part of the controls overlay: back is
          a way out of the player, not a transport control, and the
          post-play panel suppresses the transport. Folding it in there
          left the end screen with no visible exit. Over the panel it
          stops at the stage edge so its scrim doesn't bleed across the
          suggestions. */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: postPlayActive ? { xs: 0, md: "52%" } : 0,
          zIndex: 13,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          p: { xs: 1, md: 2 },
          background: `linear-gradient(to bottom, ${scrim(0.7)}, transparent)`,
          opacity: showControls || postPlayActive ? 1 : 0,
          transition: "opacity 300ms",
          pointerEvents: showControls || postPlayActive ? "auto" : "none",
        }}
      >
        <IconButton onClick={() => navigate(-1)} sx={{ color: "overlayText.primary" }}>
          <ChevronLeft size={28} />
        </IconButton>
        {movieData?.content_rating && (
          <Box sx={{ opacity: showBadge ? 1 : 0, transition: "opacity 500ms" }}>
            <ContentRatingBadge rating={movieData.content_rating} size={32} />
          </Box>
        )}
      </Box>

      {/* Skip Intro Overlay — shown only while playback is inside the
          intro window. Anchored to the right edge of the
          remaining-time label above the seek bar so the button shares
          a vertical line with it. The next-episode prompt fires near
          the end of an episode, so the two overlays never share the
          screen in practice. */}
          <Box
            sx={{
              position: "absolute",
              bottom: { xs: 80, md: 120 },
              right: { xs: 12, md: 40 },
              zIndex: 10,
              opacity: introActive ? 1 : 0,
              transition: "opacity 300ms",
              pointerEvents: introActive ? "auto" : "none",
            }}
          >
            <Button
              variant="contained"
              size="small"
              onClick={skipIntro}
              startIcon={<SkipForward size={14} />}
              sx={{
                minWidth: 140,
                px: 2.5,
                py: 1.2,
                mb: 1,
                bgcolor: whiteAlpha(1),
                color: neutral[900],
                "&:hover": { bgcolor: whiteAlpha(0.85) },
              }}
            >
              {t("player.skipIntro")}
            </Button>
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
            bgcolor: scrim(0.85),
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
              borderColor: whiteAlpha(0.3),
              "&:hover": { borderColor: whiteAlpha(0.5) },
              minWidth: 0,
              px: 1.5,
              py: 1.2,
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
              py: 1.2,
              bgcolor: whiteAlpha(1),
              color: neutral[900],
              "&:hover": { bgcolor: whiteAlpha(0.85) },
              position: "relative",
              overflow: "hidden",
              zIndex: 0,
              // The progress fill is driven by the JS countdown
              // state so it stays in sync even if the browser
              // throttles the tab (background). The `transition`
              // smooths each 1-second step instead of jumping.
              // A dark scrim so the fill stays visible on the
              // white button face.
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                bgcolor: scrim(0.15),
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

      {/* Post-play panel — what replaces the dead end at the end of a
          title. Raised for movies and for the last episode of a series;
          anything with a next episode keeps the countdown overlay
          above. Nothing here auto-advances: every suggestion is a
          click. */}
      {postPlayActive && (
        <PostPlayPanel
          ended={postPlayEnded}
          hero={postPlayHero}
          items={upNext.items}
          genreName={upNext.genreName}
          loading={upNext.isLoading}
          onSelect={openSuggestion}
          onDismiss={postPlayEnded ? null : dismissPostPlay}
          onReplay={replayFromStart}
          onExit={() => navigate(detailPath, { replace: true })}
        />
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
        slotProps={{ paper: { sx: { bgcolor: menuScrim(0.95), backdropFilter: "blur(8px)", minWidth: 220, borderRadius: 2 } } }}
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
              {quality === q && <ListItemIcon><Check size={16} color={peach.main} /></ListItemIcon>}
              <ListItemText inset={quality !== q} primary={q} />
            </MenuItem>
          )),
        ]}

        {settingsPanel === "speed" && [
          <SettingsBackItem key="back" label={t("player.speed")} onClick={() => setSettingsPanel("main")} />,
          ...SPEEDS.map((s) => (
            <MenuItem key={s} onClick={() => changeSpeed(s)}>
              {speed === s && <ListItemIcon><Check size={16} color={peach.main} /></ListItemIcon>}
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
        slotProps={{ paper: { sx: { bgcolor: menuScrim(0.95), backdropFilter: "blur(8px)", minWidth: 200, borderRadius: 2 } } }}
      >
        {audioTrackItems.map((track) => (
          <MenuItem key={track.id} onClick={() => changeAudioTrack(track.id)}>
            {currentAudioTrack === track.id && <ListItemIcon><Check size={16} color={peach.main} /></ListItemIcon>}
            <ListItemText inset={currentAudioTrack !== track.id} primary={track.label} />
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
        slotProps={{ paper: { sx: { bgcolor: menuScrim(0.95), backdropFilter: "blur(8px)", minWidth: 200, borderRadius: 2 } } }}
      >
        <MenuItem onClick={() => changeSubtitleTrack(-1)}>
          {currentSubtitleTrack === -1 && <ListItemIcon><Check size={16} color={peach.main} /></ListItemIcon>}
          <ListItemText inset={currentSubtitleTrack !== -1} primary={t("player.off")} />
        </MenuItem>
        {subtitleTrackItems.map((track) => (
          <MenuItem key={track.id} onClick={() => changeSubtitleTrack(track.id)}>
            {currentSubtitleTrack === track.id && <ListItemIcon><Check size={16} color={peach.main} /></ListItemIcon>}
            <ListItemText inset={currentSubtitleTrack !== track.id} primary={track.label} />
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

