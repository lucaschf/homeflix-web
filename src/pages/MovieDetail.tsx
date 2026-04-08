import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Typography,
} from "@mui/material";
import { Bookmark, Play, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useEnrichMovie, useIsInWatchlist, useMovie, useProgress, useToggleWatchlist } from "../api/hooks";
import { ContentRatingBadge } from "../components/ContentRatingBadge";

export function MovieDetail() {
  const { t } = useTranslation();
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const { data: movie, isLoading } = useMovie(movieId!);
  const { data: progress } = useProgress(movieId!);
  const enrichMutation = useEnrichMovie();
  const { data: inWatchlist } = useIsInWatchlist(movieId!);
  const toggleWatchlist = useToggleWatchlist();
  const hasProgress = progress && progress.status !== "completed" && progress.position_seconds > 0;
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  if (isLoading || !movie) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Hero Header */}
      <Box sx={{ position: "relative", width: "100%", height: { xs: 400, sm: 480, md: 600 }, overflow: "hidden" }}>
        {movie.backdrop_path && (
          <Box
            component="img"
            src={movie.backdrop_path}
            alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
        )}
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.7) 35%, transparent 65%)" }} />
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.4) 25%, transparent 50%)" }} />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 2, sm: 3, md: 6 }, pb: { xs: 3, md: 6 }, gap: { xs: 2, md: 4 } }}>
          {movie.poster_path && (
            <Box
              component="img"
              src={movie.poster_path}
              alt={movie.title}
              sx={{
                width: { xs: 100, sm: 140, md: 200 },
                aspectRatio: "2/3",
                borderRadius: 2,
                objectFit: "cover",
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              }}
            />
          )}

          <Box sx={{ flex: 1, minWidth: 0, maxWidth: 600 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.25rem", sm: "1.75rem", md: "2.5rem" }, fontWeight: 700, mb: 0.5 }}>
              {movie.title}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
              {movie.content_rating && (
                <ContentRatingBadge rating={movie.content_rating} size={24} />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.7rem", md: "0.75rem" } }}>{movie.year}</Typography>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.7rem", md: "0.75rem" } }}>{movie.duration_formatted}</Typography>
              {movie.genres.slice(0, 3).map((g) => (
                <Chip key={g} label={g} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 20, fontSize: "0.65rem" }} />
              ))}
            </Box>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                startIcon={<Play size={16} />}
                size="medium"
                onClick={() => navigate(`/play/movie/${movie.id}`)}
                sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}
              >
                {hasProgress ? t("detail.resume") : t("detail.watch")}
              </Button>
              <IconButton
                onClick={() => toggleWatchlist.mutate({ media_id: movie.id, media_type: "movie" })}
                sx={{
                  color: inWatchlist ? "primary.main" : "text.secondary",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 1.5,
                  width: 38,
                  height: 38,
                  "&:hover": { color: inWatchlist ? "primary.main" : "text.primary", borderColor: "rgba(255,255,255,0.4)" },
                }}
              >
                <Bookmark size={18} />
              </IconButton>
              {!movie.tmdb_id && (
                <IconButton
                  onClick={() => enrichMutation.mutate({ movieId: movie.id })}
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

      {/* Body */}
      <Box sx={{ px: { xs: 2, sm: 3, md: 6 }, py: { xs: 3, md: 4 }, maxWidth: 1000 }}>
        {movie.synopsis && (
          <>
            <Typography variant="h2" sx={{ mb: 1.5, fontSize: { xs: "1.1rem", md: "1.375rem" } }}>{t("detail.synopsis")}</Typography>
            <Collapse in={synopsisExpanded} collapsedSize={60}>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
                {movie.synopsis}
              </Typography>
            </Collapse>
            {movie.synopsis.length > 150 && (
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

        {movie.cast.length > 0 && (
          <>
            <Typography variant="h2" sx={{ mt: 3, mb: 1, fontSize: { xs: "1.1rem", md: "1.375rem" } }}>{t("detail.cast")}</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
              {movie.cast.join(", ")}
            </Typography>
          </>
        )}

        <Typography variant="h2" sx={{ mt: 3, mb: 1, fontSize: { xs: "1.1rem", md: "1.375rem" } }}>{t("detail.details")}</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {movie.directors.length > 0 && (
            <DetailRow label={t("detail.director")} value={movie.directors.join(", ")} />
          )}
          {movie.writers.length > 0 && (
            <DetailRow label={t("detail.writers")} value={movie.writers.join(", ")} />
          )}
          {movie.original_title && movie.original_title !== movie.title && (
            <DetailRow label={t("detail.originalTitle")} value={movie.original_title} />
          )}
          {movie.resolution && <DetailRow label="Resolution" value={movie.resolution} />}
          {movie.imdb_id && <DetailRow label="IMDb" value={movie.imdb_id} />}
        </Box>
      </Box>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: { xs: 80, md: 120 }, flexShrink: 0, fontSize: { xs: "0.75rem", md: "0.8rem" } }}>
        {label}:
      </Typography>
      <Typography variant="body2" sx={{ fontSize: { xs: "0.75rem", md: "0.8rem" } }}>{value}</Typography>
    </Box>
  );
}
