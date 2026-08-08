import { useMemo, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Play, RefreshCw, Clapperboard, Flag, ScrollText, Captions } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useEnrichMovie,
  useFlagMovieEnrichment,
  useIsInWatchlist,
  useMovie,
  useProgress,
  useRelatedMovies,
  useToggleWatchlist,
  useTriggerSubtitleOcr,
} from "../api/hooks";
import { useCurrentUser } from "../api/auth";
import { CreditsMarkerEditor } from "../components/admin";
import { CastCard } from "../components/CastCard";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";
import { CollectionChip } from "../components/CollectionChip";
import { MetaLine } from "../components/MetaLine";
import { QualityRail } from "../components/QualityRail";
import { TitleLogo } from "../components/TitleLogo";
import { TrailerDialog } from "../components/TrailerDialog";
import { WatchlistIconButton } from "../components/WatchlistIconButton";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDuration } from "../utils/duration";
import { formatLanguage, uniqueLanguages } from "../utils/languages";
import { ACTION_BAR_HEIGHT, fontSize, inkAlpha, panelScrim, peachAlpha, scrim, status, whiteAlpha } from "../theme/tokens";
import { neutral } from "../theme/colors";

export function MovieDetail() {
  const { t } = useTranslation();
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const { data: movie, isLoading } = useMovie(movieId!);
  const { data: relatedMovies } = useRelatedMovies(movieId);
  const { data: progress } = useProgress(movieId!);
  // Tab title flips from the bare app name to the movie name once
  // the query resolves; ``undefined`` while loading keeps the user
  // from seeing a flash of "loading · HomeFlix".
  useDocumentTitle(movie ? `${movie.title} (${movie.year})` : undefined);
  const enrichMutation = useEnrichMovie();
  const flagEnrichment = useFlagMovieEnrichment();
  const triggerOcr = useTriggerSubtitleOcr();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [flagSnack, setFlagSnack] = useState<
    { message: string; severity: "success" | "error" } | null
  >(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
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

  const handleFlagEnrichment = async () => {
    try {
      await flagEnrichment.mutateAsync(movieId!);
      setFlagSnack({ message: t("detail.flagEnrichment.success"), severity: "success" });
    } catch {
      setFlagSnack({ message: t("detail.flagEnrichment.error"), severity: "error" });
    }
  };

  const handleTriggerOcr = async () => {
    try {
      await triggerOcr.mutateAsync({ mediaKind: "movie", mediaId: movieId! });
      setFlagSnack({ message: t("detail.subtitleOcr.started"), severity: "success" });
    } catch {
      setFlagSnack({ message: t("detail.subtitleOcr.error"), severity: "error" });
    }
  };

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
        block (no bleed below). The hero is 75dvh tall with
        ``overflow: hidden`` so the image stops cleanly at the hero
        bottom. Two overlays guarantee text readability regardless of
        backdrop brightness: a 180deg gradient anchors the bottom on
        page bg (where title + pulled-up body live), and a 90deg
        gradient gives the left column (title/buttons) a darker
        backing so a blown-out backdrop center can't wash it out. */}
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
            background: `linear-gradient(180deg, ${panelScrim(0)} 0%, ${panelScrim(0)} 30%, ${panelScrim(0.5)} 55%, ${panelScrim(0.85)} 80%, ${neutral[950]} 100%)`,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: {
              xs: `linear-gradient(90deg, ${panelScrim(0.85)} 0%, ${panelScrim(0.55)} 35%, ${panelScrim(0.2)} 65%, ${panelScrim(0)} 100%)`,
              md: `linear-gradient(90deg, ${panelScrim(0.7)} 0%, ${panelScrim(0.35)} 30%, ${panelScrim(0)} 55%)`,
            },
          }}
        />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 3, md: 6 }, pb: { xs: 4, md: "20dvh" }, gap: { xs: 2, md: 4 } }}>
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
                boxShadow: `0 8px 24px ${scrim(0.6)}`,
              }}
            />
          )}

          <Box sx={{ flex: 1, minWidth: 0, maxWidth: 600, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <TitleLogo logoUrl={movie.logo_path} title={movie.title} />

            <MetaLine
              contentRating={movie.content_rating}
              items={[movie.year, formatDuration(movie.duration_seconds)]}
              genres={movie.genres}
            />


            <QualityRail
              files={movie.files}
              resolution={movie.resolution}
              languages={langs.audio.map(formatLanguage)}
            />

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="cta"
                startIcon={<Play size={16} />}
                onClick={() => navigate(`/play/movie/${movie.id}`)}
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  height: ACTION_BAR_HEIGHT,
                  px: 3.25,
                  // No padding-bottom adjustment for the progress
                  // strip — the bar is absolutely positioned at the
                  // bottom edge (3px tall) and doesn't reflow the
                  // content. The previous 16px reservation pushed
                  // the label noticeably above center, which read as
                  // a vertical-alignment bug.
                  boxShadow: `0 2px 6px ${peachAlpha(0.2)}`,
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
                      bgcolor: scrim(0.2),
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(progress.position_seconds / movie.duration_seconds) * 100}%`,
                        height: "100%",
                        bgcolor: scrim(0.55),
                      }}
                    />
                  </Box>
                )}
              </Button>
              <WatchlistIconButton
                active={!!inWatchlist}
                onClick={() => toggleWatchlist.mutate({ media_id: movie.id, media_type: "movie" })}
                addLabel={t("lists.addToList")}
                removeLabel={t("lists.removeFromList")}
              />
              {movie.trailer_url && (
                <Button
                  variant="hairline"
                  startIcon={<Clapperboard size={16} />}
                  onClick={() => setTrailerOpen(true)}
                  sx={{ height: ACTION_BAR_HEIGHT, px: 2 }}
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
              {isAdmin && movie.tmdb_id && (
                // Admin-only: report a wrong enrichment so the movie
                // re-enters the needs-review queue for relinking. Shown
                // only once the movie is enriched (has a tmdb_id) —
                // un-enriched movies use the enrich button above. The
                // flagged appearance persists across reloads via the
                // detail payload's ``needs_enrichment_review``; the
                // session mutation state covers the optimistic gap
                // before the invalidated query refetches.
                (() => {
                  const flagged = movie.needs_enrichment_review || flagEnrichment.isSuccess;
                  return (
                    <Tooltip
                      title={
                        flagged
                          ? t("detail.flagEnrichment.flagged")
                          : t("detail.flagEnrichment.tooltip")
                      }
                      arrow
                    >
                      {/* span wrapper so the tooltip still works while
                          the button is disabled (flagged state) */}
                      <span>
                        <IconButton
                          onClick={handleFlagEnrichment}
                          disabled={flagEnrichment.isPending || flagged}
                          sx={{
                            color: flagged ? status.warn.fg : "text.primary",
                            bgcolor: whiteAlpha(0.08),
                            border: `1px solid ${whiteAlpha(0.12)}`,
                            borderRadius: 1,
                            width: 46,
                            height: 46,
                            "&:hover": { bgcolor: whiteAlpha(0.12), borderColor: whiteAlpha(0.2) },
                            "&.Mui-disabled": {
                              color: flagged ? status.warn.fg : "text.disabled",
                            },
                          }}
                        >
                          <Flag size={18} fill={flagged ? "currentColor" : "none"} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  );
                })()
              )}
              {isAdmin && (
                <Tooltip title={t("admin.credits.editButton")} arrow>
                  <IconButton
                    onClick={() => setCreditsOpen(true)}
                    sx={{
                      color: movie.credits ? status.warn.fg : "text.primary",
                      bgcolor: whiteAlpha(0.08),
                      border: `1px solid ${whiteAlpha(0.12)}`,
                      borderRadius: 1,
                      width: 46,
                      height: 46,
                      "&:hover": { bgcolor: whiteAlpha(0.12), borderColor: whiteAlpha(0.2) },
                    }}
                  >
                    <ScrollText size={18} />
                  </IconButton>
                </Tooltip>
              )}
              {isAdmin && (
                <Tooltip title={t("detail.subtitleOcr.tooltip")} arrow>
                  <span>
                    <IconButton
                      onClick={handleTriggerOcr}
                      disabled={triggerOcr.isPending}
                      sx={{
                        color: "text.primary",
                        bgcolor: whiteAlpha(0.08),
                        border: `1px solid ${whiteAlpha(0.12)}`,
                        borderRadius: 1,
                        width: 46,
                        height: 46,
                        "&:hover": { bgcolor: whiteAlpha(0.12), borderColor: whiteAlpha(0.2) },
                      }}
                    >
                      <Captions size={18} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {isAdmin && creditsOpen && (
        <CreditsMarkerEditor
          open
          onClose={() => setCreditsOpen(false)}
          mediaId={movie.id}
          mediaTitle={movie.title}
          durationSeconds={movie.duration_seconds}
          marker={movie.credits}
          movieId={movie.id}
          onNotify={(message, severity) => setFlagSnack({ message, severity })}
        />
      )}

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
          px: { xs: 3, md: 6 },
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
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2.25, height: "100%" }}>
          {movie.tagline && (
            <Typography
              variant="body1"
              sx={{
                fontStyle: "italic",
                fontSize: { xs: "0.9375rem", md: "1rem" },
                lineHeight: 1.4,
                letterSpacing: "0.01em",
                color: inkAlpha(0.55),
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
                color: inkAlpha(0.78),
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
          {movie.collection && <CollectionChip collection={movie.collection} />}
          {(synopsisOverflows ||
            (isMobile ? detailRows.length > 0 : detailRows.length > DETAILS_VISIBLE_COLLAPSED)) && (
            <Typography
              variant="eyebrow"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: "primary.main",
                cursor: "pointer",
                // ``mt: auto`` pins the toggle to the bottom of this
                // (stretched) column so it sits vertically below the
                // taller technical-details column beside it, instead of
                // floating up next to the synopsis. On mobile the
                // column isn't stretched, so it just trails the content.
                mt: { md: "auto" },
                "&:hover": { opacity: 0.8 },
              }}
            >
              {expanded ? `← ${t("detail.lessDetails")}` : `${t("detail.moreDetails")} →`}
            </Typography>
          )}
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

      <Snackbar
        open={!!flagSnack}
        autoHideDuration={4000}
        onClose={() => setFlagSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {flagSnack ? (
          <Box
            sx={{
              bgcolor:
                flagSnack.severity === "success"
                  ? alpha(status.ok.base, 0.15)
                  : alpha(status.err.base, 0.18),
              border: `1px solid ${whiteAlpha(0.08)}`,
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
          >
            {flagSnack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  // Spec layout: muted label in a fixed gutter (110px) + cream value
  // wrapping to its right. Baseline-aligned so a multi-line value
  // anchors its first line to the label.
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "baseline", fontSize: fontSize.control }}>
      <Box
        component="span"
        sx={{ flexShrink: 0, minWidth: 110, color: "text.secondary", fontSize: "0.75rem" }}
      >
        {label}
      </Box>
      <Box component="span" sx={{ color: inkAlpha(0.85) }}>
        {value}
      </Box>
    </Box>
  );
}
