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
  ArrowLeft,
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
import { useMovie } from "../api/hooks";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

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

  const { data: movieData, isLoading } = useMovie(params.movieId ?? "");
  const title = isMovie
    ? movieData?.title ?? ""
    : `S${params.season?.padStart(2, "0")}E${params.episode?.padStart(2, "0")}`;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [hlsReady, setHlsReady] = useState(false);
  const [buffering, setBuffering] = useState(false);

  // Use movie metadata duration as authoritative source
  const knownDuration = movieData?.duration_seconds ?? 0;
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
  const [settingsPanel, setSettingsPanel] = useState<"main" | "quality" | "speed">("main");

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
    const onPlay = () => setPlaying(true);
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

  // Show loading while fetching movie data
  if (isMovie && isLoading) {
    return (
      <Box sx={{ position: "fixed", inset: 0, bgcolor: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === "VIDEO") togglePlay();
      }}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        bgcolor: "#000",
        cursor: showControls ? "default" : "none",
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: "#fff" }}>
            <ArrowLeft size={24} />
          </IconButton>
          <Typography variant="body1" fontWeight={600} color="#fff">
            {title}
          </Typography>
        </Box>

        {/* Center Play Button (when paused and ready) */}
        {!playing && hlsReady && (
          <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            <IconButton
              onClick={togglePlay}
              sx={{
                width: 72,
                height: 72,
                bgcolor: "rgba(232,146,111,0.9)",
                color: "#0D0D0D",
                "&:hover": { bgcolor: "rgba(232,146,111,1)" },
              }}
            >
              <Play size={36} fill="#0D0D0D" />
            </IconButton>
          </Box>
        )}

        {/* Bottom Controls */}
        <Box sx={{ px: { xs: 3, md: 5 }, pb: { xs: 2, md: 3 }, pt: 6, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
          {/* Seek Bar */}
          <Slider
            value={currentTime}
            max={displayDuration || 1}
            onChange={(_, v) => seek(v as number)}
            sx={{
              color: "primary.main",
              height: 4,
              p: 0,
              mb: 1,
              "& .MuiSlider-thumb": { width: 14, height: 14, transition: "0.1s", "&:hover": { width: 18, height: 18 } },
              "& .MuiSlider-rail": { bgcolor: "rgba(255,255,255,0.3)" },
            }}
          />

          {/* Controls Row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton onClick={() => skip(-10)} sx={{ color: "#fff" }} size="small">
              <SkipBack size={20} />
            </IconButton>
            <IconButton onClick={togglePlay} sx={{ color: "#fff" }}>
              {playing ? <Pause size={24} /> : <Play size={24} fill="#fff" />}
            </IconButton>
            <IconButton onClick={() => skip(30)} sx={{ color: "#fff" }} size="small">
              <SkipForward size={20} />
            </IconButton>

            <IconButton onClick={() => { const m = !muted; setMuted(m); if (videoRef.current) videoRef.current.muted = m; }} sx={{ color: "#fff" }} size="small">
              {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </IconButton>
            <Slider
              value={muted ? 0 : volume}
              max={1}
              step={0.05}
              onChange={changeVolume}
              sx={{
                width: 80,
                color: "#fff",
                mx: 1,
                "& .MuiSlider-thumb": { width: 12, height: 12 },
                "& .MuiSlider-rail": { bgcolor: "rgba(255,255,255,0.3)" },
              }}
            />

            <Typography variant="body2" color="#fff" sx={{ mx: 1, whiteSpace: "nowrap", fontSize: "0.75rem" }}>
              {formatTime(currentTime)} / {formatTime(displayDuration)}
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            <IconButton onClick={openSettings} sx={{ color: "#fff" }} size="small">
              <Settings size={20} />
            </IconButton>
            <IconButton sx={{ color: "#fff" }} size="small">
              <Subtitles size={20} />
            </IconButton>
            <IconButton onClick={toggleFullscreen} sx={{ color: "#fff" }} size="small">
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
    </Box>
  );
}
