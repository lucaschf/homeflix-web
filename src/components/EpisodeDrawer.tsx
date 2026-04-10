import { useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { Play, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SeriesDetail } from "../api/types";

interface EpisodeDrawerProps {
  series: SeriesDetail;
  currentSeason: number;
  currentEpisode: number;
  onSelect: (season: number, episode: number) => void;
  onClose: () => void;
}

export function EpisodeDrawer({
  series,
  currentSeason,
  currentEpisode,
  onSelect,
  onClose,
}: EpisodeDrawerProps) {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [selectedSeason, setSelectedSeason] = useState(() => {
    const idx = series.seasons.findIndex((s) => s.season_number === currentSeason);
    return idx >= 0 ? idx : 0;
  });
  const season = series.seasons[selectedSeason];

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  // Focus drawer on mount for keyboard accessibility
  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        sx={{
          position: "absolute",
          inset: 0,
          bgcolor: "rgba(0,0,0,0.5)",
          zIndex: 19,
        }}
      />

      {/* Drawer panel */}
      <Box
        ref={drawerRef}
        role="dialog"
        aria-label={t("player.episodes")}
        tabIndex={-1}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: { xs: "85%", sm: 380, md: 400 },
          bgcolor: "rgba(13,13,13,0.95)",
          backdropFilter: "blur(12px)",
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Typography variant="subtitle1" fontWeight={700} color="#fff" sx={{ fontSize: "0.95rem" }}>
            {series.title}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: "text.secondary" }} size="small" aria-label={t("player.cancel")}>
            <X size={18} />
          </IconButton>
        </Box>

        {/* Season tabs */}
        {series.seasons.length > 1 && (
          <Tabs
            value={selectedSeason}
            onChange={(_, v) => setSelectedSeason(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 36,
              px: 1,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              "& .MuiTab-root": { color: "text.secondary", textTransform: "none", minHeight: 36, py: 0, fontSize: "0.8rem" },
              "& .Mui-selected": { color: "primary.main" },
              "& .MuiTabs-indicator": { bgcolor: "primary.main" },
            }}
          >
            {series.seasons.map((s, idx) => (
              <Tab
                key={s.season_number}
                value={idx}
                label={s.season_number === 0 ? t("detail.specials") : `S${String(s.season_number).padStart(2, "0")}`}
              />
            ))}
          </Tabs>
        )}

        {/* Episode list */}
        <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }} role="listbox" aria-label={t("player.episodes")}>
          {season?.episodes.map((ep) => {
            const isCurrent = season.season_number === currentSeason && ep.episode_number === currentEpisode;
            return (
              <Box
                key={ep.episode_number}
                role="option"
                aria-selected={isCurrent}
                onClick={() => onSelect(season.season_number, ep.episode_number)}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  px: 2,
                  py: 1,
                  cursor: "pointer",
                  bgcolor: isCurrent ? "rgba(232,146,111,0.12)" : "transparent",
                  borderLeft: isCurrent ? "3px solid" : "3px solid transparent",
                  borderColor: isCurrent ? "primary.main" : "transparent",
                  "&:hover": { bgcolor: isCurrent ? "rgba(232,146,111,0.16)" : "rgba(255,255,255,0.04)" },
                }}
              >
                {/* Thumbnail */}
                <Box sx={{ width: 100, flexShrink: 0, aspectRatio: "16/9", borderRadius: 1, overflow: "hidden", bgcolor: "rgba(255,255,255,0.05)", position: "relative" }}>
                  {(ep.thumbnail_path || series.poster_path) ? (
                    <Box component="img" src={ep.thumbnail_path ?? series.poster_path!} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Box sx={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)" }} />
                  )}
                  {isCurrent && (
                    <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.5)" }}>
                      <Play size={20} color="#E8926F" fill="#E8926F" />
                    </Box>
                  )}
                  {ep.progress_percentage != null && ep.progress_percentage > 0 && (
                    <LinearProgress
                      variant="determinate"
                      value={ep.progress_percentage}
                      sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        bgcolor: "rgba(255,255,255,0.2)",
                        "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
                      }}
                    />
                  )}
                </Box>

                {/* Info */}
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <Typography
                    variant="body2"
                    fontWeight={isCurrent ? 700 : 500}
                    color={isCurrent ? "primary.main" : "#fff"}
                    noWrap
                    sx={{ fontSize: "0.8rem" }}
                  >
                    {`${ep.episode_number}. ${ep.title}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    {ep.duration_formatted}
                  </Typography>
                  {ep.synopsis && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        mt: 0.25,
                        fontSize: "0.65rem",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {ep.synopsis}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </>
  );
}
