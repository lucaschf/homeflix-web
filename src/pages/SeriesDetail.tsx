import { useRef, useState } from "react";
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
  Tooltip,
  Typography,
} from "@mui/material";
import { Bookmark, Play, RefreshCw, Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useContinueWatching, useEnrichSeries, useIsInWatchlist, useSeriesDetail, useToggleWatchlist } from "../api/hooks";
import type { ContinueWatchingItem, EpisodeOutput, SeriesDetail as SeriesDetailType } from "../api/types";
import { ContentRatingBadge } from "../components/ContentRatingBadge";
import { TrailerDialog } from "../components/TrailerDialog";

export function SeriesDetail() {
  const { t } = useTranslation();
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const { data: series, isLoading } = useSeriesDetail(seriesId!);
  const enrichMutation = useEnrichSeries();
  const { data: inWatchlist } = useIsInWatchlist(seriesId!);
  const toggleWatchlist = useToggleWatchlist();
  const { data: continueWatching } = useContinueWatching();
  const [selectedSeason, setSelectedSeason] = useState(0);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const synopsisRef = useRef<HTMLDivElement>(null);
  const SYNOPSIS_COLLAPSED = 44;

  if (isLoading || !series) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const currentSeason = series.seasons[selectedSeason];

  // Find in-progress episode for this series from continue watching
  const inProgressEpisode = findInProgressEpisode(continueWatching, series);

  const firstEpisode = series.seasons[0]?.episodes[0];
  const playTarget = inProgressEpisode
    ? { season: inProgressEpisode.seasonNumber, episode: inProgressEpisode.episodeNumber }
    : { season: firstEpisode ? series.seasons[0].season_number : 1, episode: firstEpisode?.episode_number ?? 1 };

  const playLabel = inProgressEpisode
    ? `${t("detail.resume")} E${inProgressEpisode.episodeNumber}`
    : firstEpisode
      ? `${t("detail.watch")} E${firstEpisode.episode_number}`
      : t("detail.watch");

  return (
    <Box>
      {/* Hero Header */}
      <Box sx={{ position: "relative", width: "100%", height: "56dvh", minHeight: 400 }}>
        {series.backdrop_path && (
          <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: { xs: -200, md: -250 } }}>
            <Box
              component="img"
              src={series.backdrop_path}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          </Box>
        )}
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: { xs: -200, md: -250 }, background: { xs: "linear-gradient(to right, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.75) 50%, rgba(13,13,13,0.3) 100%)", md: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.6) 40%, transparent 70%)" } }} />
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: { xs: -200, md: -250 }, background: { xs: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.95) 8%, rgba(13,13,13,0.78) 20%, rgba(13,13,13,0.5) 35%, rgba(13,13,13,0.2) 55%, transparent 75%)", md: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.92) 8%, rgba(13,13,13,0.7) 18%, rgba(13,13,13,0.4) 32%, rgba(13,13,13,0.15) 50%, transparent 70%)" } }} />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 2, sm: 3, md: 6 }, pb: { xs: 4, md: 6 }, gap: { xs: 2, md: 4 } }}>
          {series.poster_path && (
            <Box
              component="img"
              src={series.poster_path}
              alt={series.title}
              sx={{
                width: { xs: 100, sm: 140, md: 200 },
                aspectRatio: "2/3",
                borderRadius: 2,
                objectFit: "cover",
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              }}
            />
          )}

          <Box sx={{ flex: 1, minWidth: 0, maxWidth: 600, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.25rem", sm: "1.75rem", md: "2.5rem" }, fontWeight: 700, mb: 0.5 }}>
              {series.title}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
              {series.content_rating && <ContentRatingBadge rating={series.content_rating} size={24} />}
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.7rem", md: "0.75rem" } }}>
                {series.start_year}{series.end_year ? `–${series.end_year}` : "–"}
              </Typography>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.7rem", md: "0.75rem" } }}>
                {t("common.seasons", { count: series.season_count })}
              </Typography>
              {series.genres.slice(0, 3).map((g) => (
                <Chip key={g} label={g} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 20, fontSize: "0.65rem" }} />
              ))}
            </Box>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                startIcon={<Play size={16} />}
                size="medium"
                sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}
                onClick={() => navigate(`/play/episode/${series.id}/${playTarget.season}/${playTarget.episode}`)}
              >
                {playLabel}
              </Button>
              <Tooltip title={inWatchlist ? t("lists.removeFromList") : t("lists.addToList")} arrow>
                <IconButton
                  onClick={() => toggleWatchlist.mutate({ media_id: series.id, media_type: "series" })}
                  sx={{
                    color: inWatchlist ? "primary.main" : "text.secondary",
                    border: inWatchlist ? "1px solid" : "1px solid rgba(255,255,255,0.2)",
                    borderColor: inWatchlist ? "primary.main" : undefined,
                    borderRadius: 1.5,
                    width: 38,
                    height: 38,
                    "&:hover": { color: inWatchlist ? "primary.main" : "text.primary", borderColor: inWatchlist ? "primary.main" : "rgba(255,255,255,0.4)" },
                  }}
                >
                  <Bookmark size={18} fill={inWatchlist ? "currentColor" : "none"} />
                </IconButton>
              </Tooltip>
              {series.trailer_url && (
                <Button
                  variant="outlined"
                  startIcon={<Clapperboard size={16} />}
                  onClick={() => setTrailerOpen(true)}
                  sx={{
                    color: "text.secondary",
                    borderColor: "rgba(255,255,255,0.2)",
                    "&:hover": { color: "text.primary", borderColor: "rgba(255,255,255,0.4)" },
                    height: 38,
                    fontSize: { xs: "0.8rem", md: "0.875rem" },
                  }}
                >
                  {t("detail.trailer")}
                </Button>
              )}
              {!series.tmdb_id && (
                <IconButton
                  onClick={() => enrichMutation.mutate({ seriesId: series.id })}
                  disabled={enrichMutation.isPending}
                  sx={{ color: "text.secondary" }}
                  size="small"
                >
                  <RefreshCw size={18} />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {series.trailer_url && (
        <TrailerDialog open={trailerOpen} onClose={() => setTrailerOpen(false)} url={series.trailer_url} />
      )}

      {/* Body */}
      <Box sx={{ position: "relative", zIndex: 1, px: { xs: 2, sm: 3, md: 6 }, pt: { xs: 2, md: 3 }, pb: { xs: 3, md: 4 } }}>
        {series.synopsis && (
          <>
            <Collapse in={synopsisExpanded} collapsedSize={SYNOPSIS_COLLAPSED}>
              <Typography ref={synopsisRef} variant="body1" color="text.secondary" sx={{ maxWidth: 800, fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
                {series.synopsis}
              </Typography>
            </Collapse>
            {(synopsisRef.current?.scrollHeight ?? 0) > SYNOPSIS_COLLAPSED && (
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
                <EpisodeRow key={ep.episode_number} episode={ep} seriesPoster={series.poster_path} onPlay={() => navigate(`/play/episode/${series.id}/${currentSeason.season_number}/${ep.episode_number}`)} />
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

/** Find the most recent in-progress episode for this series from continue watching data. */
function findInProgressEpisode(
  continueWatching: ContinueWatchingItem[] | undefined,
  series: SeriesDetailType | undefined,
): { seasonNumber: number; episodeNumber: number } | null {
  if (!continueWatching || !series) return null;

  // Find the most recently watched episode for this series
  let best: { seasonNumber: number; episodeNumber: number; lastWatched: string } | null = null;
  for (const item of continueWatching) {
    if (item.media_type !== "episode") continue;
    if (item.series_id === series.id && item.season_number != null && item.episode_number != null) {
      if (!best || item.last_watched_at > best.lastWatched) {
        best = { seasonNumber: item.season_number, episodeNumber: item.episode_number, lastWatched: item.last_watched_at };
      }
    }
  }
  if (best) return { seasonNumber: best.seasonNumber, episodeNumber: best.episodeNumber };

  // Fallback: pick the highest-numbered in-progress episode from API data
  let fallback: { seasonNumber: number; episodeNumber: number } | null = null;
  for (const season of series.seasons) {
    for (const ep of season.episodes) {
      if (ep.watch_status === "in_progress") {
        if (
          !fallback ||
          season.season_number > fallback.seasonNumber ||
          (season.season_number === fallback.seasonNumber && ep.episode_number > fallback.episodeNumber)
        ) {
          fallback = { seasonNumber: season.season_number, episodeNumber: ep.episode_number };
        }
      }
    }
  }

  return fallback;
}

function EpisodeRow({ episode, seriesPoster, onPlay }: { episode: EpisodeOutput; seriesPoster: string | null; onPlay: () => void }) {
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
      <Box sx={{ position: "relative", width: { xs: 110, sm: 140, md: 200 }, flexShrink: 0, aspectRatio: "16/9", borderRadius: 1.5, overflow: "hidden", bgcolor: "background.paper" }}>
        {(episode.thumbnail_path || seriesPoster) ? (
          <Box component="img" src={episode.thumbnail_path ?? seriesPoster!} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

        {episode.progress_percentage != null && episode.progress_percentage > 0 && (
          <LinearProgress
            variant="determinate"
            value={episode.progress_percentage}
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              bgcolor: "rgba(255,255,255,0.2)",
              "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
            }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mb: 0.25 }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
            {t("detail.episode", { number: episode.episode_number })}
          </Typography>
          <Typography variant="body2" fontWeight={500} noWrap sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
            {episode.title}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontSize: { xs: "0.65rem", md: "0.7rem" } }}>
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
