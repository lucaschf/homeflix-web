import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { Heart, Play, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useEnrichSeries, useSeriesDetail } from "../api/hooks";
import type { EpisodeOutput } from "../api/types";

export function SeriesDetail() {
  const { t } = useTranslation();
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const { data: series, isLoading } = useSeriesDetail(seriesId!);
  const enrichMutation = useEnrichSeries();
  const [selectedSeason, setSelectedSeason] = useState(0);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  if (isLoading || !series) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const currentSeason = series.seasons[selectedSeason];

  return (
    <Box>
      {/* Hero Header */}
      <Box sx={{ position: "relative", width: "100%", height: { xs: 450, md: 550 }, overflow: "hidden" }}>
        {series.backdrop_path && (
          <Box
            component="img"
            src={series.backdrop_path}
            alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.7) 35%, transparent 65%)" }} />
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.4) 25%, transparent 50%)" }} />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 3, md: 6 }, pb: { xs: 4, md: 6 }, gap: 4 }}>
          {series.poster_path && (
            <Box
              component="img"
              src={series.poster_path}
              alt={series.title}
              sx={{
                width: { xs: 140, md: 200 },
                aspectRatio: "2/3",
                borderRadius: 2,
                objectFit: "cover",
                display: { xs: "none", sm: "block" },
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              }}
            />
          )}

          <Box sx={{ flex: 1, maxWidth: 600 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.5rem" }, fontWeight: 700, mb: 1 }}>
              {series.title}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {series.start_year}{series.end_year ? `–${series.end_year}` : "–"}
              </Typography>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("common.seasons", { count: series.season_count })}
              </Typography>
              {series.genres.map((g) => (
                <Chip key={g} label={g} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 22, fontSize: "0.7rem" }} />
              ))}
            </Box>

            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button variant="contained" startIcon={<Play size={18} />} size="large">
                {t("detail.watchNow")}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Plus size={18} />}
                size="large"
                sx={{ borderColor: "rgba(255,255,255,0.3)", color: "text.primary", "&:hover": { borderColor: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.05)" } }}
              >
                {t("detail.addToList")}
              </Button>
              <IconButton sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}>
                <Heart size={22} />
              </IconButton>
              {!series.tmdb_id && (
                <IconButton
                  onClick={() => enrichMutation.mutate({ seriesId: series.id })}
                  disabled={enrichMutation.isPending}
                  sx={{ color: "text.secondary" }}
                >
                  <RefreshCw size={20} />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ px: { xs: 3, md: 6 }, py: 4 }}>
        {series.synopsis && (
          <>
            <Collapse in={synopsisExpanded} collapsedSize={44}>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 800 }}>
                {series.synopsis}
              </Typography>
            </Collapse>
            {series.synopsis.length > 150 && (
              <Typography
                variant="body2"
                onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                sx={{ color: "primary.main", cursor: "pointer", mt: 0.5, "&:hover": { textDecoration: "underline" } }}
              >
                {synopsisExpanded ? t("detail.showLess") : t("detail.showMore")}
              </Typography>
            )}
          </>
        )}

        {/* Season Tabs */}
        {series.seasons.length > 0 && (
          <>
            <Tabs
              value={selectedSeason}
              onChange={(_, v) => setSelectedSeason(v)}
              sx={{
                mt: 4,
                mb: 3,
                "& .MuiTab-root": { color: "text.secondary", textTransform: "none", fontWeight: 500 },
                "& .Mui-selected": { color: "primary.main" },
                "& .MuiTabs-indicator": { bgcolor: "primary.main" },
              }}
            >
              {series.seasons.map((s, idx) => (
                <Tab
                  key={s.season_number}
                  value={idx}
                  label={s.season_number === 0 ? t("detail.specials") : t("detail.season", { number: s.season_number })}
                />
              ))}
            </Tabs>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {currentSeason?.episodes.map((ep) => (
                <EpisodeRow key={ep.episode_number} episode={ep} onPlay={() => navigate(`/play/episode/${series.id}/${currentSeason.season_number}/${ep.episode_number}`)} />
              ))}
              {(!currentSeason || currentSeason.episodes.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                  {t("detail.noEpisodes")}
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

function EpisodeRow({ episode, onPlay }: { episode: EpisodeOutput; onPlay: () => void }) {
  const { t } = useTranslation();

  return (
    <Box
      onClick={onPlay}
      sx={{
        display: "flex",
        gap: 2,
        p: 1.5,
        borderRadius: 2,
        cursor: "pointer",
        "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
        "&:hover .ep-play": { opacity: 1 },
      }}
    >
      <Box sx={{ position: "relative", width: { xs: 140, md: 200 }, flexShrink: 0, aspectRatio: "16/9", borderRadius: 1.5, overflow: "hidden", bgcolor: "background.paper" }}>
        {episode.thumbnail_path ? (
          <Box component="img" src={episode.thumbnail_path} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Box sx={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)" }} />
        )}

        <Box
          className="ep-play"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.4)",
            opacity: 0,
            transition: "opacity 200ms",
          }}
        >
          <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={20} color="#0D0D0D" fill="#0D0D0D" />
          </Box>
        </Box>

        {/* Progress bar placeholder - will work with WatchProgress */}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
          <Typography variant="body1" fontWeight={600}>
            {t("detail.episode", { number: episode.episode_number })}
          </Typography>
          <Typography variant="body1" fontWeight={500} noWrap>
            {episode.title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {episode.duration_formatted}
          {episode.air_date && ` | ${episode.air_date}`}
        </Typography>
        {episode.synopsis && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: { xs: "none", md: "-webkit-box" },
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {episode.synopsis}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
