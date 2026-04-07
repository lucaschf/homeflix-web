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
import { Heart, Play, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useEnrichMovie, useMovie, useProgress } from "../api/hooks";
import { ContentRatingBadge } from "../components/ContentRatingBadge";

export function MovieDetail() {
  const { t } = useTranslation();
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const { data: movie, isLoading } = useMovie(movieId!);
  const { data: progress } = useProgress(movieId!);
  const enrichMutation = useEnrichMovie();
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
      <Box sx={{ position: "relative", width: "100%", height: { xs: 450, md: 550 }, overflow: "hidden" }}>
        {movie.backdrop_path && (
          <Box
            component="img"
            src={movie.backdrop_path}
            alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.7) 35%, transparent 65%)" }} />
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.4) 25%, transparent 50%)" }} />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 3, md: 6 }, pb: { xs: 4, md: 6 }, gap: 4 }}>
          {movie.poster_path && (
            <Box
              component="img"
              src={movie.poster_path}
              alt={movie.title}
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
              {movie.title}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
              {movie.content_rating && (
                <ContentRatingBadge rating={movie.content_rating} />
              )}
              <Typography variant="body2" color="text.secondary">{movie.year}</Typography>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary">{movie.duration_formatted}</Typography>
              {movie.genres.map((g) => (
                <Chip key={g} label={g} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 22, fontSize: "0.7rem" }} />
              ))}
            </Box>

            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button variant="contained" startIcon={<Play size={18} />} size="large" onClick={() => navigate(`/play/movie/${movie.id}`)}>
                {hasProgress ? t("detail.resume") : t("detail.watchNow")}
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
              {!movie.tmdb_id && (
                <IconButton
                  onClick={() => enrichMutation.mutate({ movieId: movie.id })}
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
      <Box sx={{ px: { xs: 3, md: 6 }, py: 4, maxWidth: 1000 }}>
        {movie.synopsis && (
          <>
            <Typography variant="h2" sx={{ mb: 1.5 }}>{t("detail.synopsis")}</Typography>
            <Collapse in={synopsisExpanded} collapsedSize={60}>
              <Typography variant="body1" color="text.secondary">
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
            <Typography variant="h2" sx={{ mt: 4, mb: 1.5 }}>{t("detail.cast")}</Typography>
            <Typography variant="body1" color="text.secondary">
              {movie.cast.join(", ")}
            </Typography>
          </>
        )}

        <Typography variant="h2" sx={{ mt: 4, mb: 1.5 }}>{t("detail.details")}</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>{label}:</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}
