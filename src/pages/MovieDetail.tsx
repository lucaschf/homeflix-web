import { useMemo, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Bookmark, Play, RefreshCw, Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useEnrichMovie,
  useIsInWatchlist,
  useMovie,
  useProgress,
  useRelatedMovies,
  useToggleWatchlist,
} from "../api/hooks";
import { CastCard } from "../components/CastCard";
import { ContentRatingBadge } from "../components/ContentRatingBadge";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";
import { TitleLogo } from "../components/TitleLogo";
import { TrailerDialog } from "../components/TrailerDialog";
import { formatDuration } from "../utils/duration";
import { formatLanguage, uniqueLanguages } from "../utils/languages";

export function MovieDetail() {
  const { t } = useTranslation();
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const { data: movie, isLoading } = useMovie(movieId!);
  const { data: relatedMovies } = useRelatedMovies(movieId ?? "");
  const { data: progress } = useProgress(movieId!);
  const enrichMutation = useEnrichMovie();
  const { data: inWatchlist } = useIsInWatchlist(movieId!);
  const toggleWatchlist = useToggleWatchlist();
  const hasProgress = progress && progress.status !== "completed" && progress.position_seconds > 0;
  const langs = useMemo(() => uniqueLanguages(movie?.files ?? []), [movie?.files]);
  const theme = useTheme();
  // Mobile mode hides ALL detail rows behind the toggle (Crunchyroll
  // style — vertical space is too precious to spend on a fixed
  // initial details list). Desktop keeps the first ``DETAILS_VISIBLE_COLLAPSED``
  // rows visible at a glance and the toggle reveals the rest.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // Single ``expanded`` state controls BOTH the synopsis line-clamp
  // and how many ``DetailRow``s are visible — Crunchyroll-style
  // "Mais detalhes" toggle that opens both columns of the body grid
  // together, so the user reads "the rest of the page" with one
  // click instead of two separate toggles.
  const [expanded, setExpanded] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const synopsisRef = useRef<HTMLDivElement>(null);
  const SYNOPSIS_LINES = 3;
  const DETAILS_VISIBLE_COLLAPSED = 2;
  // Track whether the synopsis text overflows the clamped box so the
  // toggle link can render without reading ref.current during render
  // (React 19 flags ref reads in render). Only checks while
  // collapsed — at that point ``scrollHeight`` is the full text and
  // ``clientHeight`` is the line-clamped box, so a strict ``>``
  // means there's hidden content waiting on the toggle.
  const [synopsisOverflows, setSynopsisOverflows] = useState(false);
  useEffect(() => {
    if (expanded) return;
    const el = synopsisRef.current;
    if (!el) return;
    const check = () => setSynopsisOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [movie?.synopsis, expanded]);

  // Order matters: audio + subtitles first because they're the most
  // useful "at a glance" facts for a media library — what languages
  // am I getting? Matches how Crunchyroll orders the same panel.
  // Computed once so both the right column and the "Mais detalhes"
  // toggle below can consult ``rows.length`` consistently.
  const detailRows = useMemo(() => {
    if (!movie) return [];
    const rows: { label: string; value: string }[] = [];
    if (langs.audio.length > 0) {
      rows.push({ label: t("detail.audio"), value: langs.audio.map(formatLanguage).join(", ") });
    }
    if (langs.subtitle.length > 0) {
      rows.push({
        label: t("detail.subtitles"),
        value: langs.subtitle.map(formatLanguage).join(", "),
      });
    }
    if (movie.directors.length > 0) {
      rows.push({ label: t("detail.director"), value: movie.directors.join(", ") });
    }
    if (movie.writers.length > 0) {
      rows.push({ label: t("detail.writers"), value: movie.writers.join(", ") });
    }
    if (movie.original_title && movie.original_title !== movie.title) {
      rows.push({ label: t("detail.originalTitle"), value: movie.original_title });
    }
    if (movie.resolution) {
      rows.push({ label: "Resolution", value: movie.resolution });
    }
    if (movie.imdb_id) {
      rows.push({ label: "IMDb", value: movie.imdb_id });
    }
    return rows;
  }, [movie, langs, t]);

  if (isLoading || !movie) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Hero Header — keeps the immersive backdrop + gradient
        treatment from the HeroBanner carousel but a touch shorter
        (56dvh vs 75dvh) so the body and cast carousel stay in the
        first fold on a typical desktop viewport. The vertical
        ``pb`` on the inner content matches HeroBanner's ``8/22`` so
        the title + buttons don't crash into the body grid. */}
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
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: { xs: -200, md: -250 },
            background: {
              xs: "linear-gradient(to right, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.75) 50%, rgba(13,13,13,0.3) 100%)",
              md: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.6) 40%, transparent 70%)",
            },
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: { xs: -200, md: -250 },
            background: {
              xs: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.95) 8%, rgba(13,13,13,0.78) 20%, rgba(13,13,13,0.5) 35%, rgba(13,13,13,0.2) 55%, transparent 75%)",
              md: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.92) 8%, rgba(13,13,13,0.7) 18%, rgba(13,13,13,0.4) 32%, rgba(13,13,13,0.15) 50%, transparent 70%)",
            },
          }}
        />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 2, sm: 3, md: 6 }, pb: { xs: 4, md: 6 }, gap: { xs: 2, md: 4 } }}>
          {movie.poster_path && !movie.logo_path && (
            // Poster is shown only when there's no localized title-logo
            // — when the logo is present it carries the visual identity
            // and the poster would compete for attention. Titles
            // without a TMDB logo (less popular catalog items) keep
            // the poster so the header still feels rich.
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
            />

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
              {movie.content_rating && (
                <ContentRatingBadge rating={movie.content_rating} size={24} />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.85rem", md: "0.95rem" } }}>{movie.year}</Typography>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.85rem", md: "0.95rem" } }}>{formatDuration(movie.duration_seconds)}</Typography>
              {movie.genres.slice(0, 3).map((g) => (
                <Chip key={g} label={g} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 22, fontSize: "0.75rem" }} />
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

      {/* Body — Crunchyroll-style two-column on md+: synopsis on the
        left, key / value details on the right. Stacks to single
        column on xs/sm. The cast row sits below the grid so it can
        breathe across the full content width regardless of the
        column split above. */}
      <Grid
        container
        spacing={{ xs: 3, md: 6 }}
        sx={{
          position: "relative",
          zIndex: 1,
          px: { xs: 2, sm: 3, md: 6 },
          pt: { xs: 1, md: 1 },
          pb: { xs: 3, md: 4 },
          maxWidth: 1600,
        }}
      >
        <Grid size={{ xs: 12, md: 6 }}>
          {movie.synopsis && (
            <Typography
              ref={synopsisRef}
              variant="body1"
              color="text.secondary"
              sx={{
                fontSize: { xs: "0.9rem", md: "1.0rem" },
                // CSS line-clamp clamps at exactly ``SYNOPSIS_LINES``
                // whole lines — no partial-letter sliver from a
                // height that doesn't divide evenly into the line
                // height. The "Mais detalhes" toggle below lifts
                // this clamp AND reveals the hidden detail rows on
                // the right at the same time, Crunchyroll-style.
                ...(expanded
                  ? {}
                  : {
                      display: "-webkit-box",
                      WebkitLineClamp: SYNOPSIS_LINES,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }),
              }}
            >
              {movie.synopsis}
            </Typography>
          )}
          {(synopsisOverflows ||
            (isMobile ? detailRows.length > 0 : detailRows.length > DETAILS_VISIBLE_COLLAPSED)) && (
            <Typography
              variant="body2"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: "primary.main",
                cursor: "pointer",
                mt: 1.5,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {expanded ? t("detail.lessDetails") : t("detail.moreDetails")}
            </Typography>
          )}
        </Grid>

        {(() => {
          // Visible row count depends on viewport AND expand state:
          //   mobile + collapsed → 0 rows (column hidden entirely)
          //   mobile + expanded  → all rows (stacks below synopsis)
          //   desktop + collapsed → first ``DETAILS_VISIBLE_COLLAPSED``
          //   desktop + expanded → all rows
          const visible = expanded
            ? detailRows
            : isMobile
              ? []
              : detailRows.slice(0, DETAILS_VISIBLE_COLLAPSED);
          if (visible.length === 0) return null;
          return (
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {visible.map((row) => (
                  <DetailRow key={row.label} label={row.label} value={row.value} />
                ))}
              </Box>
            </Grid>
          );
        })()}
      </Grid>

      {movie.cast.length > 0 && (
        // Reuse ``MediaCarousel`` so the cast row gets the same
        // hover-arrows + hidden-scrollbar UX as the genre carousels
        // on the home/browse pages — one navigation pattern across
        // every horizontal list. ``zIndex: 1`` keeps the cards above
        // the page-level backdrop / gradient layers.
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <MediaCarousel title={t("detail.cast")}>
            {movie.cast.map((member, idx) => (
              <CastCard key={`${member.name}-${idx}`} member={member} />
            ))}
          </MediaCarousel>
        </Box>
      )}

      {relatedMovies && relatedMovies.length > 0 && (
        // "You might also like" — TMDB recommendations filtered to
        // titles that exist in the local catalog. The use case
        // returns ``[]`` when the source movie has no ``tmdb_id``,
        // when TMDB returns nothing, or when no recommendation
        // overlaps with the catalog; the carousel simply doesn't
        // render in those cases (no empty header).
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <MediaCarousel title={t("detail.related")}>
            {relatedMovies.map((m) => (
              <MediaCard
                key={m.id}
                title={m.title}
                year={m.year}
                imageUrl={m.poster_path ?? undefined}
                synopsis={m.synopsis ?? undefined}
                variant="poster"
                mediaId={m.id}
                mediaType="movie"
                onPlay={() => navigate(`/play/movie/${m.id}`)}
                onClick={() => navigate(`/movie/${m.id}`)}
              />
            ))}
          </MediaCarousel>
        </Box>
      )}

      {movie.trailer_url && (
        <TrailerDialog open={trailerOpen} onClose={() => setTrailerOpen(false)} url={movie.trailer_url} />
      )}
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  // Crunchyroll-style inline row: label and value share one
  // ``<Typography>`` so long values wrap naturally to a second
  // line at the right edge of the column instead of being clipped
  // into a fixed-width label gutter. ``component="span"`` on the
  // bold label keeps it inline with the surrounding text.
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ fontSize: { xs: "0.85rem", md: "0.9rem" }, lineHeight: 1.4 }}
    >
      <Box
        component="span"
        sx={{ fontWeight: 600, color: "text.primary", mr: 0.5 }}
      >
        {label}:
      </Box>
      {value}
    </Typography>
  );
}
