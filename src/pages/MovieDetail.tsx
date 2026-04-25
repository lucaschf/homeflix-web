import { useMemo, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { Bookmark, Play, RefreshCw, Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useEnrichMovie, useIsInWatchlist, useMovie, useProgress, useToggleWatchlist } from "../api/hooks";
import { ContentRatingBadge } from "../components/ContentRatingBadge";
import { TitleLogo } from "../components/TitleLogo";
import { TrailerDialog } from "../components/TrailerDialog";
import { formatLanguage, uniqueLanguages } from "../utils/languages";

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
  const langs = useMemo(() => uniqueLanguages(movie?.files ?? []), [movie?.files]);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const synopsisRef = useRef<HTMLDivElement>(null);
  const SYNOPSIS_COLLAPSED = 60;
  // Track whether the synopsis text overflows the collapsed height
  // via state so the "Show more" link can render without reading
  // ref.current during render (which React 19 flags as unsafe).
  const [synopsisOverflows, setSynopsisOverflows] = useState(false);
  useEffect(() => {
    const el = synopsisRef.current;
    if (!el) return;
    const check = () => setSynopsisOverflows(el.scrollHeight > SYNOPSIS_COLLAPSED);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [SYNOPSIS_COLLAPSED]);

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
      <Box sx={{ position: "relative", width: "100%", height: "56dvh", minHeight: 400 }}>
        {movie.backdrop_path && (
          <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: { xs: -200, md: -250 } }}>
            <Box
              component="img"
              src={movie.backdrop_path}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          </Box>
        )}
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: { xs: -200, md: -250 }, background: { xs: "linear-gradient(to right, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.75) 50%, rgba(13,13,13,0.3) 100%)", md: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.6) 40%, transparent 70%)" } }} />
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: { xs: -200, md: -250 }, background: { xs: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.95) 8%, rgba(13,13,13,0.78) 20%, rgba(13,13,13,0.5) 35%, rgba(13,13,13,0.2) 55%, transparent 75%)", md: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.92) 8%, rgba(13,13,13,0.7) 18%, rgba(13,13,13,0.4) 32%, rgba(13,13,13,0.15) 50%, transparent 70%)" } }} />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 2, sm: 3, md: 6 }, pb: { xs: 4, md: 6 }, gap: { xs: 2, md: 4 } }}>
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

          <Box sx={{ flex: 1, minWidth: 0, maxWidth: 600, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <TitleLogo
              logoUrl={movie.logo_path}
              title={movie.title}
              maxHeight={{ xs: 50, sm: 70, md: 100 }}
              fallbackVariant="h1"
              fallbackFontSize={{ xs: "1.25rem", sm: "1.75rem", md: "2.5rem" }}
              sx={{ mb: 0.5 }}
            />

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
              <Tooltip title={inWatchlist ? t("lists.removeFromList") : t("lists.addToList")} arrow>
                <IconButton
                  onClick={() => toggleWatchlist.mutate({ media_id: movie.id, media_type: "movie" })}
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
              {movie.trailer_url && (
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
      <Box sx={{ position: "relative", zIndex: 1, px: { xs: 2, sm: 3, md: 6 }, pt: { xs: 2, md: 3 }, pb: { xs: 3, md: 4 }, maxWidth: 1000 }}>
        {movie.synopsis && (
          <>
            <Typography variant="h2" sx={{ mb: 1.5, fontSize: { xs: "1.1rem", md: "1.375rem" } }}>{t("detail.synopsis")}</Typography>
            <Collapse in={synopsisExpanded} collapsedSize={SYNOPSIS_COLLAPSED}>
              <Typography ref={synopsisRef} variant="body1" color="text.secondary" sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
                {movie.synopsis}
              </Typography>
            </Collapse>
            {synopsisOverflows && (
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
          {langs.audio.length > 0 && (
            <DetailRow label={t("detail.audio")} value={langs.audio.map(formatLanguage).join(", ")} />
          )}
          {langs.subtitle.length > 0 && (
            <DetailRow label={t("detail.subtitles")} value={langs.subtitle.map(formatLanguage).join(", ")} />
          )}
          {movie.imdb_id && <DetailRow label="IMDb" value={movie.imdb_id} />}
        </Box>
      </Box>

      {movie.trailer_url && (
        <TrailerDialog open={trailerOpen} onClose={() => setTrailerOpen(false)} url={movie.trailer_url} />
      )}
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
