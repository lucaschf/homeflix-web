import { useMemo, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
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
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";
import { CollectionChip } from "../components/CollectionChip";
import { MetaLine } from "../components/MetaLine";
import { QualityRail } from "../components/QualityRail";
import { TitleLogo } from "../components/TitleLogo";
import { TrailerDialog } from "../components/TrailerDialog";
import { formatDuration } from "../utils/duration";
import { formatLanguage, uniqueLanguages } from "../utils/languages";

export function MovieDetail() {
  const { t } = useTranslation();
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const { data: movie, isLoading } = useMovie(movieId!);
  const { data: relatedMovies } = useRelatedMovies(movieId);
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
  const DETAILS_VISIBLE_COLLAPSED = 4;
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
    <Box sx={{ position: "relative" }}>
      {/* Hero — matches the refined spec: a self-contained backdrop
        block (no bleed below). The hero is 85dvh tall with
        ``overflow: hidden`` so the image stops cleanly at the hero
        bottom. A single 180deg gradient over the image keeps the
        top fully visible, fades to ~70% dark at 88%, and lands on
        solid page bg at the bottom edge — so body content below
        starts on the page bg with no visible seam. */}
      <Box sx={{ position: "relative", width: "100%", height: "75dvh", minHeight: 460, overflow: "hidden" }}>
        {movie.backdrop_path && (
          <Box
            component="img"
            src={movie.backdrop_path}
            alt=""
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
            }}
          />
        )}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 0%, transparent 65%, rgba(13,13,13,0.7) 88%, #0D0D0D 100%)",
          }}
        />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 2, sm: 3, md: 6 }, pb: { xs: 4, md: "20dvh" }, gap: { xs: 2, md: 4 } }}>
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

            <MetaLine
              contentRating={movie.content_rating}
              year={movie.year}
              duration={formatDuration(movie.duration_seconds)}
              genres={movie.genres}
            />


            <QualityRail
              files={movie.files}
              resolution={movie.resolution}
              languages={langs.audio.map(formatLanguage)}
            />

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                startIcon={<Play size={16} />}
                onClick={() => navigate(`/play/movie/${movie.id}`)}
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  position: "relative",
                  overflow: "hidden",
                  height: 46,
                  px: 3.25,
                  pb: hasProgress ? "16px" : undefined,
                  boxShadow: "0 2px 6px rgba(217,119,87,0.2)",
                }}
              >
                {hasProgress
                  ? `${t("detail.resume")} · ${t("detail.remaining", { time: formatDuration(movie.duration_seconds - progress.position_seconds) })}`
                  : t("detail.watch")}
                {hasProgress && (
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      bgcolor: "rgba(0,0,0,0.2)",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(progress.position_seconds / movie.duration_seconds) * 100}%`,
                        height: "100%",
                        bgcolor: "rgba(0,0,0,0.55)",
                      }}
                    />
                  </Box>
                )}
              </Button>
              <Tooltip title={inWatchlist ? t("lists.removeFromList") : t("lists.addToList")} arrow>
                <IconButton
                  onClick={() => toggleWatchlist.mutate({ media_id: movie.id, media_type: "movie" })}
                  sx={{
                    color: inWatchlist ? "primary.main" : "text.primary",
                    bgcolor: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderColor: inWatchlist ? "primary.main" : "rgba(255,255,255,0.12)",
                    borderRadius: 1,
                    width: 46,
                    height: 46,
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.12)",
                      borderColor: inWatchlist ? "primary.main" : "rgba(255,255,255,0.2)",
                    },
                  }}
                >
                  <Bookmark size={18} fill={inWatchlist ? "currentColor" : "none"} />
                </IconButton>
              </Tooltip>
              {movie.trailer_url && (
                <Button
                  startIcon={<Clapperboard size={16} />}
                  onClick={() => setTrailerOpen(true)}
                  sx={{
                    color: "text.primary",
                    bgcolor: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 1,
                    height: 46,
                    px: 2,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.12)",
                      borderColor: "rgba(255,255,255,0.2)",
                    },
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

      {/* Body — two-column 1.4fr / 1fr on md+, stacked on mobile.
        Left: synopsis + "Mais detalhes" toggle. Right: eyebrow-
        labeled technical metadata with the same toggle expanding
        the row count. ``zIndex: 1`` keeps the content above the
        hero's bleed. */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
          columnGap: { md: 10 },
          rowGap: { xs: 3, md: 0 },
          px: { xs: 2, sm: 3, md: 6 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 4, md: 5 },
          // Pull the body up so it starts right below the hero title
          // (which we anchor at 55dvh from the page top). Without this
          // the body waits for the 75dvh hero to end and a ~20dvh
          // empty band sits between the title and the synopsis.
          mt: { md: "-19dvh" },
          maxWidth: 1600,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2.25 }}>
          {movie.tagline && (
            <Typography
              variant="body1"
              sx={{
                fontStyle: "italic",
                fontSize: { xs: "0.9375rem", md: "1rem" },
                lineHeight: 1.4,
                letterSpacing: "0.01em",
                color: "rgba(245,241,235,0.55)",
                m: 0,
              }}
            >
              {movie.tagline}
            </Typography>
          )}
          {movie.synopsis && (
            <Typography
              ref={synopsisRef}
              variant="body1"
              sx={{
                fontSize: { xs: "0.875rem", md: "0.9375rem" },
                lineHeight: 1.65,
                color: "rgba(245,241,235,0.78)",
                m: 0,
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
              variant="eyebrow"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: "primary.main",
                cursor: "pointer",
                "&:hover": { opacity: 0.8 },
              }}
            >
              {expanded ? `← ${t("detail.lessDetails")}` : `${t("detail.moreDetails")} →`}
            </Typography>
          )}
          {movie.collection && <CollectionChip collection={movie.collection} />}
        </Box>

        {(() => {
          const visible = expanded
            ? detailRows
            : isMobile
              ? []
              : detailRows.slice(0, DETAILS_VISIBLE_COLLAPSED);
          if (visible.length === 0) return null;
          return (
            <Box sx={{ pt: { md: "6px" } }}>
              <Typography
                variant="eyebrow"
                sx={{ color: "text.secondary", mb: 1.75 }}
              >
                {t("detail.technicalDetails")}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                {visible.map((row) => (
                  <MetaRow key={row.label} label={row.label} value={row.value} />
                ))}
              </Box>
            </Box>
          );
        })()}
      </Box>

      {movie.cast.length > 0 && (
        // Reuse ``MediaCarousel`` so the cast row gets the same
        // hover-arrows + hidden-scrollbar UX as the genre carousels
        // on the home/browse pages — one navigation pattern across
        // every horizontal list. ``zIndex: 1`` keeps the cards above
        // the hero's bleed layers.
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <MediaCarousel title={t("detail.cast")} headingVariant="h3">
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
          <MediaCarousel title={t("detail.related")} headingVariant="h3">
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

function MetaRow({ label, value }: { label: string; value: string }) {
  // Spec layout: muted label in a fixed gutter (110px) + cream value
  // wrapping to its right. Baseline-aligned so a multi-line value
  // anchors its first line to the label.
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "baseline", fontSize: "0.8125rem" }}>
      <Box
        component="span"
        sx={{ flexShrink: 0, minWidth: 110, color: "text.secondary", fontSize: "0.75rem" }}
      >
        {label}
      </Box>
      <Box component="span" sx={{ color: "rgba(245,241,235,0.85)" }}>
        {value}
      </Box>
    </Box>
  );
}
