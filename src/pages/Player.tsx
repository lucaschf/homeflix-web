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
  const saveProgress = useSaveProgress();
  const saveProgressRef = useRef(saveProgress.mutate);
  saveProgressRef.current = saveProgress.mutate;
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
  const containerRef = useRef<HTMLDivElement>(null);
  // Holds the mediaId whose audio/subtitle selection has already been
  // restored from savedProgress, so the restore effect runs again the first
  // time `mediaId` changes (e.g. on auto-advance to the next episode). A
  // simple boolean would lock after the first episode and silently skip
  // restoring tracks for every episode after that.
  const progressRestoredForMediaIdRef = useRef<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [nextEpCountdown, setNextEpCountdown] = useState<number | null>(null);
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
  const [speed, setSpeed] = useState(1);
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

  // Quality list pulled from the movie's file variants. Memoized so the
  // array identity is stable across renders — without `useMemo` the
  // `?.map(...)` chain produces a fresh array reference on every render
  // and the downstream useEffect's `qualities` dependency changes identity
  // every render, re-firing the effect for nothing. The body is guarded
  // by `!quality` so it short-circuits in practice, but it's pointless
  // work and a foot-gun if the body ever grows past the guard.
  const qualities = useMemo(
    () => movieData?.files?.map((f) => f.resolution) ?? [],
    [movieData?.files],
  );
  const [quality, setQuality] = useState("");

  useEffect(() => {
    if (qualities.length > 0 && !quality) {
      const primary = movieData?.files?.find((f) => f.is_primary);
      setQuality(primary?.resolution ?? qualities[0]);
    }
  }, [qualities, quality, movieData]);

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

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
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
  }, [volume, muted, hlsReady]);

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

  // Restore saved audio/subtitle track selection on first play. Position is
  // already handled by the backend via the ?start=startOffset query param —
  // ffmpeg starts transcoding from that point, so the video element begins
  // at internal currentTime = 0, which corresponds to display time =
  // startOffset. No seek is needed here.
  //
  // The "already restored" guard is keyed on mediaId so the effect re-runs
  // the first time hls becomes ready for a new episode (auto-advance) — a
  // simple boolean flag would lock after the first episode and silently
  // skip restoring tracks for every episode after that.
  useEffect(() => {
    if (!savedProgress) return;
    if (progressRestoredForMediaIdRef.current === mediaId) return;
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || !hlsReady) return;

    progressRestoredForMediaIdRef.current = mediaId;
    // Only restore audio track if the saved value is non-default AND
    // different from the current selection. Setting hls.audioTrack on
    // HLS.js — even to the same value it already is — can trigger a
    // buffer flush of the audio segments, which manifests as the audio
    // dropping out for a few seconds right after playback starts.
    if (
      savedProgress.audio_track != null &&
      savedProgress.audio_track !== 0 &&
      hls &&
      hls.audioTrack !== savedProgress.audio_track
    ) {
      hls.audioTrack = savedProgress.audio_track;
    }
    if (
      savedProgress.subtitle_track != null &&
      savedProgress.subtitle_track !== -1 &&
      hls &&
      hls.subtitleTrack !== savedProgress.subtitle_track
    ) {
      hls.subtitleTrack = savedProgress.subtitle_track;
    }
  }, [savedProgress, hlsReady, mediaId]);

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

  // Save on page unload
  useEffect(() => {
    window.addEventListener("beforeunload", saveCurrentProgress);
    return () => window.removeEventListener("beforeunload", saveCurrentProgress);
  }, [saveCurrentProgress]);

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
  }, [isMovie, nextEpisode, navigate, saveCurrentProgress]);

  // Navigate when countdown reaches 0
  useEffect(() => {
    if (nextEpCountdown === 0) goToNextEpisode();
  }, [nextEpCountdown, goToNextEpisode]);

  // Cleanup stray timers on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case "arrowleft":
          video.currentTime = Math.max(0, video.currentTime - 10);
          resetHideTimer();
          break;
        case "arrowright":
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 30);
          resetHideTimer();
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((v) => { const nv = Math.min(1, v + 0.1); video.volume = nv; return nv; });
          resetHideTimer();
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((v) => { const nv = Math.max(0, v - 0.1); video.volume = nv; return nv; });
          resetHideTimer();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          setMuted((m) => { video.muted = !m; return !m; });
          resetHideTimer();
          break;
        case "escape":
          if (isFullscreen) document.exitFullscreen();
          else navigate(-1);
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [displayDuration, isFullscreen, navigate, resetHideTimer]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
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
    setSpeed(s);
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

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      el.requestFullscreen();
      setIsFullscreen(true);
    }
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
      <Box sx={{ position: "fixed", inset: 0, bgcolor: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const currentAudioName = audioTracks.find((t) => t.id === currentAudioTrack)?.name ?? "";
  const subtitlesActive = currentSubtitleTrack >= 0;

  return (
    <Box
      ref={containerRef}
      onMouseMove={resetHideTimer}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        bgcolor: "#000",
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
          <IconButton onClick={() => navigate(-1)} sx={{ color: "#fff" }}>
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
                  color: "#0D0D0D",
                  pointerEvents: "none",
                }}
              >
                <Play size={36} fill="#0D0D0D" />
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

          {/* Seek Bar */}
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
              "& .MuiSlider-rail": { bgcolor: "rgba(255,255,255,0.3)" },
            }}
          />

          {/* Controls Row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, md: 0.5 } }}>
            <IconButton onClick={() => skip(-10)} sx={{ color: "#fff", p: { xs: 1, md: 0.75 } }}>
              <SkipBack size={20} />
            </IconButton>
            <IconButton onClick={togglePlay} sx={{ color: "#fff", p: { xs: 1, md: 0.75 } }}>
              {playing ? <Pause size={24} /> : <Play size={24} fill="#fff" />}
            </IconButton>
            <IconButton onClick={() => skip(30)} sx={{ color: "#fff", p: { xs: 1, md: 0.75 } }}>
              <SkipForward size={20} />
            </IconButton>

            <IconButton
              onClick={() => { const m = !muted; setMuted(m); if (videoRef.current) videoRef.current.muted = m; }}
              sx={{ color: "#fff", p: { xs: 1, md: 0.75 } }}
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
                color: "#fff",
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
                sx={{ color: episodeDrawerOpen ? "primary.main" : "#fff", p: { xs: 1, md: 0.75 } }}
              >
                <LayoutList size={20} />
              </IconButton>
            )}
            <IconButton onClick={openSettings} sx={{ color: "#fff", p: { xs: 1, md: 0.75 } }}>
              <Settings size={20} />
            </IconButton>
            {audioTracks.length > 1 && (
              <IconButton onClick={openAudio} sx={{ color: "#fff", p: { xs: 1, md: 0.75 } }}>
                <AudioLines size={20} />
              </IconButton>
            )}
            {subtitleTracks.length > 0 && (
              <IconButton
                onClick={openSubtitles}
                sx={{ color: subtitlesActive ? "primary.main" : "#fff", p: { xs: 1, md: 0.75 } }}
              >
                <Subtitles size={20} />
              </IconButton>
            )}
            <IconButton onClick={toggleFullscreen} sx={{ color: "#fff", p: { xs: 1, md: 0.75 } }}>
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
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(255,255,255,0.2)",
                transformOrigin: "left",
                animation: "fill-progress 10s linear forwards",
                zIndex: -1,
              },
              "@keyframes fill-progress": {
                from: { transform: "scaleX(0)" },
                to: { transform: "scaleX(1)" },
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
        container={containerRef.current}
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
            <MenuItem key={q} onClick={() => { setQuality(q); setSettingsPanel("main"); }}>
              {quality === q && <ListItemIcon><Check size={16} color="#E8926F" /></ListItemIcon>}
              <ListItemText inset={quality !== q} primary={q} />
            </MenuItem>
          )),
        ]}

        {settingsPanel === "speed" && [
          <SettingsBackItem key="back" label={t("player.speed")} onClick={() => setSettingsPanel("main")} />,
          ...SPEEDS.map((s) => (
            <MenuItem key={s} onClick={() => changeSpeed(s)}>
              {speed === s && <ListItemIcon><Check size={16} color="#E8926F" /></ListItemIcon>}
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
        container={containerRef.current}
        slotProps={{ paper: { sx: { bgcolor: "rgba(28,28,28,0.95)", backdropFilter: "blur(8px)", minWidth: 200, borderRadius: 2 } } }}
      >
        {audioTracks.map((track) => (
          <MenuItem key={track.id} onClick={() => changeAudioTrack(track.id)}>
            {currentAudioTrack === track.id && <ListItemIcon><Check size={16} color="#E8926F" /></ListItemIcon>}
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
        container={containerRef.current}
        slotProps={{ paper: { sx: { bgcolor: "rgba(28,28,28,0.95)", backdropFilter: "blur(8px)", minWidth: 200, borderRadius: 2 } } }}
      >
        <MenuItem onClick={() => changeSubtitleTrack(-1)}>
          {currentSubtitleTrack === -1 && <ListItemIcon><Check size={16} color="#E8926F" /></ListItemIcon>}
          <ListItemText inset={currentSubtitleTrack !== -1} primary={t("player.off")} />
        </MenuItem>
        {subtitleTracks.map((track) => (
          <MenuItem key={track.id} onClick={() => changeSubtitleTrack(track.id)}>
            {currentSubtitleTrack === track.id && <ListItemIcon><Check size={16} color="#E8926F" /></ListItemIcon>}
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

