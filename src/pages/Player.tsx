import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
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

export function Player() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{
    movieId?: string;
    seriesId?: string;
    season?: string;
    episode?: string;
  }>();

  // Determine HLS playlist URL
  const isMovie = !!params.movieId;
  const hlsUrl = isMovie
    ? `/api/v1/stream/movie/${params.movieId}/hls/playlist.m3u8`
    : `/api/v1/stream/episode/${params.seriesId}/${params.season}/${params.episode}/hls/playlist.m3u8`;

  const mediaId = isMovie
    ? params.movieId ?? ""
    : `epi_${params.seriesId}_${params.season}_${params.episode}`;
  const mediaType = isMovie ? "movie" : "episode";

  const { data: movieData, isLoading: movieLoading } = useMovie(params.movieId ?? "");
  const { data: seriesData, isLoading: seriesLoading } = useSeriesDetail(params.seriesId ?? "");
  const isLoading = isMovie ? movieLoading : seriesLoading;

  // Find episode duration from series data
  const episodeDuration = (() => {
    if (isMovie || !seriesData) return 0;
    const seasonNum = Number(params.season);
    const episodeNum = Number(params.episode);
    const season = seriesData.seasons.find((s) => s.season_number === seasonNum);
    const episode = season?.episodes.find((e) => e.episode_number === episodeNum);
    return episode?.duration_seconds ?? 0;
  })();
  const { data: savedProgress } = useProgress(mediaId);
  const saveProgress = useSaveProgress();
  const saveProgressRef = useRef(saveProgress.mutate);
  saveProgressRef.current = saveProgress.mutate;
  const title = isMovie
    ? movieData?.title ?? ""
    : (() => {
        const seasonNum = Number(params.season);
        const episodeNum = Number(params.episode);
        const season = seriesData?.seasons.find((s) => s.season_number === seasonNum);
        const episode = season?.episodes.find((e) => e.episode_number === episodeNum);
        const epTitle = episode?.title ?? "";
        const prefix = `S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")}`;
        return epTitle ? `${prefix} - ${epTitle}` : prefix;
      })();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRestoredRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
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

  // Use metadata duration as authoritative source (movie or episode)
  const knownDuration = isMovie ? (movieData?.duration_seconds ?? 0) : episodeDuration;
  const displayDuration = knownDuration > 0 ? knownDuration : duration;

  // Quality from movie files
  const qualities = movieData?.files?.map((f) => f.resolution) ?? [];
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

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
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
  }, [knownDuration]);

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

  // Restore saved progress (position, audio, subtitle) on first play
  useEffect(() => {
    if (!savedProgress || progressRestoredRef.current) return;
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || !hlsReady) return;

    progressRestoredRef.current = true;
    if (savedProgress.position_seconds > 0 && savedProgress.status !== "completed") {
      video.currentTime = savedProgress.position_seconds;
    }
    if (savedProgress.audio_track != null && hls) {
      hls.audioTrack = savedProgress.audio_track;
    }
    if (savedProgress.subtitle_track != null && hls) {
      hls.subtitleTrack = savedProgress.subtitle_track;
    }
  }, [savedProgress, hlsReady]);

  // Auto-save progress every 10 seconds during playback
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || !mediaId) return;
      const dur = displayDuration || video.duration;
      if (!dur) return;
      saveProgressRef.current({
        media_id: mediaId,
        media_type: mediaType,
        position_seconds: Math.floor(video.currentTime),
        duration_seconds: Math.floor(dur),
        audio_track: hlsRef.current?.audioTrack,
        subtitle_track: hlsRef.current?.subtitleTrack,
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [playing, mediaId, mediaType, displayDuration]);

  // Save progress on pause or unmount
  const saveCurrentProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !mediaId) return;
    const dur = displayDuration || video.duration;
    if (!dur || video.currentTime === 0) return;
    saveProgressRef.current({
      media_id: mediaId,
      media_type: mediaType,
      position_seconds: Math.floor(video.currentTime),
      duration_seconds: Math.floor(dur),
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

  // Save on page unload
  useEffect(() => {
    window.addEventListener("beforeunload", saveCurrentProgress);
    return () => window.removeEventListener("beforeunload", saveCurrentProgress);
  }, [saveCurrentProgress]);

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
          video.currentTime = Math.min(displayDuration, video.currentTime + 30);
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

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(displayDuration, video.currentTime + seconds));
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
            <Typography variant="body1" color="#fff">
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
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
            <Typography variant="body1" fontWeight={600} color="#fff" noWrap sx={{ fontSize: { xs: "0.95rem", md: "1.1rem" }, flex: 1, mr: 2 }}>
              {title}
            </Typography>
            <Typography variant="body1" color="rgba(255,255,255,0.7)" sx={{ whiteSpace: "nowrap", fontSize: { xs: "0.85rem", md: "0.95rem" } }}>
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
          <MenuItem key="back" onClick={() => setSettingsPanel("main")}>
            <ListItemIcon><ArrowLeft size={16} color="#fff" /></ListItemIcon>
            <ListItemText primary={t("player.quality")} />
          </MenuItem>,
          ...qualities.map((q) => (
            <MenuItem key={q} onClick={() => { setQuality(q); setSettingsPanel("main"); }}>
              {quality === q && <ListItemIcon><Check size={16} color="#E8926F" /></ListItemIcon>}
              <ListItemText inset={quality !== q} primary={q} />
            </MenuItem>
          )),
        ]}

        {settingsPanel === "speed" && [
          <MenuItem key="back" onClick={() => setSettingsPanel("main")}>
            <ListItemIcon><ArrowLeft size={16} color="#fff" /></ListItemIcon>
            <ListItemText primary={t("player.speed")} />
          </MenuItem>,
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
