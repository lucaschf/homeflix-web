import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Snackbar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { GalleryHorizontalEnd, LayoutGrid, List, Play, RefreshCw, Clapperboard, Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useContinueWatching, useEnrichSeries, useFlagSeriesEnrichment, useIsInWatchlist, useRelatedSeries, useSeriesDetail, useToggleWatchlist } from "../api/hooks";
import { useCurrentUser } from "../api/auth";
import type { ContinueWatchingItem, EpisodeOutput, SeriesDetail as SeriesDetailType } from "../api/types";
import { formatDuration } from "../utils/duration";
import { formatLanguage, uniqueLanguages } from "../utils/languages";
import { CastCard } from "../components/CastCard";
import { DetailSkeleton } from "../components/DetailSkeleton";
import { EpisodeCard } from "../components/EpisodeCard";
import { HorizontalScroller } from "../components/HorizontalScroller";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";
import { MetaLine } from "../components/MetaLine";
import { TitleLogo } from "../components/TitleLogo";
import { useToast } from "../components/ToastProvider";
import { TrailerDialog } from "../components/TrailerDialog";
import { WatchlistIconButton } from "../components/WatchlistIconButton";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { neutral } from "../theme/colors";
import { ACTION_BAR_HEIGHT, fontFamily, inkAlpha, panelScrim, scrim, status, whiteAlpha } from "../theme/tokens";

type EpisodeView = "list" | "cards" | "grid";

const EPISODE_VIEW_STORAGE_KEY = "homeflix:episode-view";

function readStoredView(): EpisodeView {
  // Default to the Prime-Video-style grid — it fills the width and
  // reads best for browsing a season. A stored preference always
  // wins. Reading from localStorage in the initializer keeps the
  // first paint stable — no flash from grid to the stored view on
  // hydration.
  if (typeof window === "undefined") return "grid";
  const stored = window.localStorage.getItem(EPISODE_VIEW_STORAGE_KEY);
  return stored === "list" || stored === "cards" || stored === "grid" ? stored : "grid";
}

export function SeriesDetail() {
  const { t } = useTranslation();
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const { data: series, isLoading } = useSeriesDetail(seriesId!);
  useDocumentTitle(series?.title);
  const enrichMutation = useEnrichSeries();
  const flagEnrichment = useFlagSeriesEnrichment();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [flagSnack, setFlagSnack] = useState<
    { message: string; severity: "success" | "error" } | null
  >(null);
  const { data: inWatchlist } = useIsInWatchlist(seriesId!);
  const toggleWatchlist = useToggleWatchlist();
  const { showToast } = useToast();
  const { data: continueWatching } = useContinueWatching();
  const { data: relatedSeries } = useRelatedSeries(seriesId);
  const [selectedSeason, setSelectedSeason] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [episodeView, setEpisodeView] = useState<EpisodeView>(readStoredView);
  useEffect(() => {
    window.localStorage.setItem(EPISODE_VIEW_STORAGE_KEY, episodeView);
  }, [episodeView]);
  const synopsisRef = useRef<HTMLDivElement>(null);
  const SYNOPSIS_LINES = 3;
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
  }, [series?.synopsis, expanded]);

  const handleFlagEnrichment = async () => {
    try {
      await flagEnrichment.mutateAsync(seriesId!);
      setFlagSnack({ message: t("detail.flagEnrichment.success"), severity: "success" });
    } catch {
      setFlagSnack({ message: t("detail.flagEnrichment.error"), severity: "error" });
    }
  };

  if (isLoading || !series) {
    return <DetailSkeleton />;
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
    <Box sx={{ position: "relative" }}>
      {/* Hero Header — same structure as the home ``HeroBanner``:
        backdrop image and gradient overlays bleed below the hero
        box so the cinematic backdrop reaches the bottom edge of
        the viewport. ``56dvh`` hero + ``-44dvh`` bleed = ``100dvh``
        total, matching ``HeroBanner``'s look on common viewports. */}
      <Box sx={{ position: "relative", width: "100%", height: "56dvh", minHeight: 400 }}>
        {series.backdrop_path && (
          <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "-44dvh" }}>
            <Box
              component="img"
              src={series.backdrop_path}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          </Box>
        )}
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "-44dvh", background: { xs: `linear-gradient(to right, ${panelScrim(0.97)} 0%, ${panelScrim(0.75)} 50%, ${panelScrim(0.3)} 100%)`, md: `linear-gradient(to right, ${panelScrim(0.95)} 0%, ${panelScrim(0.6)} 40%, transparent 70%)` } }} />
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "-44dvh", background: { xs: `linear-gradient(to top, ${panelScrim(1)} 0%, ${panelScrim(1)} 35%, ${panelScrim(0.85)} 45%, ${panelScrim(0.5)} 58%, ${panelScrim(0.2)} 72%, transparent 85%)`, md: `linear-gradient(to top, ${panelScrim(1)} 0%, ${panelScrim(1)} 30%, ${panelScrim(0.85)} 40%, ${panelScrim(0.5)} 55%, ${panelScrim(0.15)} 70%, transparent 80%)` } }} />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 3, md: 6 }, pb: { xs: 4, md: 6 }, gap: { xs: 2, md: 4 } }}>
          {series.poster_path && !series.logo_path && (
            // See ``MovieDetail`` — poster is only shown when no
            // title-logo is available, otherwise the two compete for
            // visual identity at the top of the hero.
            <Box
              component="img"
              src={series.poster_path}
              alt={series.title}
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
            <TitleLogo logoUrl={series.logo_path} title={series.title} />

            <MetaLine
              contentRating={series.content_rating}
              items={[
                `${series.start_year}${series.end_year ? `–${series.end_year}` : "–"}`,
                t("common.seasons", { count: series.season_count }),
              ]}
              genres={series.genres}
            />

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="cta"
                startIcon={<Play size={16} />}
                sx={{ height: ACTION_BAR_HEIGHT, px: 3.25 }}
                onClick={() => navigate(`/play/episode/${series.id}/${playTarget.season}/${playTarget.episode}`)}
              >
                {playLabel}
              </Button>
              <WatchlistIconButton
                active={!!inWatchlist}
                onClick={() =>
                  toggleWatchlist.mutate(
                    { media_id: series.id, media_type: "series" },
                    {
                      onSuccess: (res) =>
                        showToast(
                          t(res.data.added ? "lists.addedToList" : "lists.removedFromList"),
                        ),
                    },
                  )
                }
                addLabel={t("lists.addToList")}
                removeLabel={t("lists.removeFromList")}
              />
              {series.trailer_url && (
                <Button
                  variant="hairline"
                  startIcon={<Clapperboard size={16} />}
                  onClick={() => setTrailerOpen(true)}
                  sx={{ height: ACTION_BAR_HEIGHT, px: 2 }}
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
              {isAdmin && series.tmdb_id && (
                // Admin-only: report a wrong enrichment so the series
                // re-enters the needs-review queue for relinking. Shown
                // only once enriched (has a tmdb_id). Flagged state
                // persists across reloads via the detail payload's
                // ``needs_enrichment_review``; the mutation success
                // state covers the optimistic gap before refetch.
                (() => {
                  const flagged = series.needs_enrichment_review || flagEnrichment.isSuccess;
                  return (
                    <Tooltip
                      title={
                        flagged
                          ? t("detail.flagEnrichment.flagged")
                          : t("detail.flagEnrichment.tooltip")
                      }
                      arrow
                    >
                      {/* span keeps the tooltip working while disabled */}
                      <span>
                        <IconButton
                          onClick={handleFlagEnrichment}
                          disabled={flagEnrichment.isPending || flagged}
                          sx={{
                            color: flagged ? status.warn.fg : "text.primary",
                            bgcolor: whiteAlpha(0.08),
                            border: `1px solid ${whiteAlpha(0.12)}`,
                            borderRadius: 1,
                            width: ACTION_BAR_HEIGHT,
                            height: ACTION_BAR_HEIGHT,
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
            </Box>
          </Box>
        </Box>
      </Box>

      {series.trailer_url && (
        <TrailerDialog open={trailerOpen} onClose={() => setTrailerOpen(false)} url={series.trailer_url} />
      )}

      {/* Body — ``zIndex: 1`` keeps content above the hero's bleed
        layers (which extend to the viewport bottom). */}
      <Box sx={{ position: "relative", zIndex: 1, px: { xs: 3, md: 6 }, pt: { xs: 1, md: 1 }, pb: { xs: 3, md: 4 } }}>
        {series.synopsis && (
          <>
            <Typography
              ref={synopsisRef}
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 800,
                fontSize: { xs: "0.9rem", md: "1.0rem" },
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
              {series.synopsis}
            </Typography>
            {synopsisOverflows && (
              <Typography
                variant="eyebrow"
                onClick={() => setExpanded(!expanded)}
                sx={{
                  color: "primary.main",
                  cursor: "pointer",
                  mt: 1.5,
                  "&:hover": { opacity: 0.8 },
                }}
              >
                {expanded ? `← ${t("detail.lessDetails")}` : `${t("detail.moreDetails")} →`}
              </Typography>
            )}
          </>
        )}

        {/* Season Tabs */}
        {series.seasons.length > 0 && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mt: 4, mb: 3 }}>
              {episodeView !== "list" ? (
                // The card-based views (carousel + grid) keep the
                // season picker compact so the cards have the full
                // width to breathe. Tabs would either wrap or fight
                // the cards for horizontal space at narrow widths.
                <Select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  size="small"
                  sx={{
                    minWidth: 200,
                    color: "text.primary",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: whiteAlpha(0.15) },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: whiteAlpha(0.3) },
                  }}
                >
                  {series.seasons.map((s, idx) => (
                    <MenuItem key={s.season_number} value={idx}>
                      {s.season_number === 0 ? t("detail.specials") : t("detail.season", { number: s.season_number })}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Tabs
                  value={selectedSeason}
                  onChange={(_, v) => setSelectedSeason(v)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
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
              )}
              <ToggleButtonGroup
                value={episodeView}
                exclusive
                size="small"
                onChange={(_, next) => {
                  if (next) setEpisodeView(next as EpisodeView);
                }}
                aria-label={t("detail.viewList")}
                sx={{ flexShrink: 0 }}
              >
                <ToggleButton value="list" aria-label={t("detail.viewList")}>
                  <List size={16} />
                </ToggleButton>
                <ToggleButton value="cards" aria-label={t("detail.viewCards")}>
                  <GalleryHorizontalEnd size={16} />
                </ToggleButton>
                <ToggleButton value="grid" aria-label={t("detail.viewGrid")}>
                  <LayoutGrid size={16} />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {(!currentSeason || currentSeason.episodes.length === 0) ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                {t("detail.noEpisodes")}
              </Typography>
            ) : episodeView === "list" ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {currentSeason.episodes.map((ep) => (
                  <EpisodeRow
                    key={ep.episode_number}
                    episode={ep}
                    seriesPoster={series.poster_path}
                    onPlay={() => navigate(`/play/episode/${series.id}/${currentSeason.season_number}/${ep.episode_number}`)}
                  />
                ))}
              </Box>
            ) : episodeView === "grid" ? (
              // Prime-Video-style grid: the same cards laid out in a
              // responsive MUI Grid that fills the row (no trailing
              // gap). Each cell owns the column width; the card fills
              // it via ``fullWidth``.
              <Grid container spacing={2}>
                {currentSeason.episodes.map((ep) => (
                  <Grid key={ep.episode_number} size={{ xs: 6, sm: 4, md: 3, lg: 2.4, xl: 2 }}>
                    <EpisodeCard
                      episode={ep}
                      seriesId={series.id}
                      seasonNumber={currentSeason.season_number}
                      seriesPoster={series.poster_path}
                      onPlay={() => navigate(`/play/episode/${series.id}/${currentSeason.season_number}/${ep.episode_number}`)}
                      fullWidth
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <HorizontalScroller>
                {currentSeason.episodes.map((ep) => (
                  <EpisodeCard
                    key={ep.episode_number}
                    episode={ep}
                    seriesId={series.id}
                    seasonNumber={currentSeason.season_number}
                    seriesPoster={series.poster_path}
                    onPlay={() => navigate(`/play/episode/${series.id}/${currentSeason.season_number}/${ep.episode_number}`)}
                  />
                ))}
              </HorizontalScroller>
            )}
          </>
        )}
      </Box>

      {/* ``cast`` only landed on the API after this UI shipped, so
          coerce the missing field to an empty list at the boundary
          to keep older backend builds from crashing the page. */}
      {(() => {
        const cast = series.cast ?? [];
        if (cast.length === 0) return null;
        return (
          // Sits OUTSIDE the body's padded box so MediaCarousel's
          // own ``px`` lines up with the genre rows on Home/Browse —
          // wrapping it inside the body would double the horizontal
          // padding and push the first card inwards. ``zIndex: 1``
          // keeps the cards above the hero's bleed layers.
          <Box sx={{ position: "relative", zIndex: 1, pb: { xs: 3, md: 4 } }}>
            <MediaCarousel title={t("detail.cast")} headingVariant="h3">
              {cast.map((member, idx) => (
                <CastCard
                  // Prefer the TMDB person id when present — stable
                  // across re-fetches, no collision risk on homonyms.
                  // Fall back to ``name-idx`` for legacy rows
                  // enriched before the id was captured.
                  key={member.tmdb_id ?? `${member.name}-${idx}`}
                  member={member}
                />
              ))}
            </MediaCarousel>
          </Box>
        );
      })()}

      {relatedSeries && relatedSeries.length > 0 && (
        // "You might also like" — TMDB recommendations filtered to
        // series that exist in the local catalog. Backend returns
        // ``[]`` when the source series has no ``tmdb_id``, when
        // TMDB returns nothing, or when no recommendation overlaps
        // with the catalog; the carousel simply doesn't render in
        // those cases (no empty header). Sits OUTSIDE the body's
        // padded box for the same alignment reason as the cast row.
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <MediaCarousel title={t("detail.related")} headingVariant="h3">
            {relatedSeries.map((s) => (
              <MediaCard
                key={s.id}
                title={s.title}
                year={s.start_year}
                imageUrl={s.poster_path ?? undefined}
                synopsis={s.synopsis ?? undefined}
                variant="poster"
                mediaId={s.id}
                mediaType="series"
                onClick={() => navigate(`/series/${s.id}`)}
              />
            ))}
          </MediaCarousel>
        </Box>
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
  const langs = uniqueLanguages(episode.files ?? []);
  // Same availability rule as EpisodeCard — keeps the card and the
  // list view in sync so an episode that's "missing" looks missing
  // regardless of which view the user picked.
  const isAvailable = (episode.files?.length ?? 0) > 0;

  return (
    <Box
      onClick={isAvailable ? onPlay : undefined}
      aria-disabled={isAvailable ? undefined : true}
      title={isAvailable ? undefined : t("episode.unavailableTooltip")}
      sx={{
        display: "flex",
        gap: 2,
        p: 1.5,
        borderRadius: 2,
        cursor: isAvailable ? "pointer" : "default",
        "&:hover": isAvailable ? { bgcolor: whiteAlpha(0.04) } : {},
        "&:hover .ep-play": isAvailable ? { opacity: 1 } : {},
      }}
    >
      <Box sx={{ position: "relative", width: { xs: 110, sm: 140, md: 200 }, flexShrink: 0, aspectRatio: "16/9", borderRadius: 1.5, overflow: "hidden", bgcolor: "background.paper" }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            filter: isAvailable ? "none" : "grayscale(1)",
            opacity: isAvailable ? 1 : 0.55,
          }}
        >
          {(episode.thumbnail_path || seriesPoster) ? (
            <Box component="img" src={episode.thumbnail_path ?? seriesPoster!} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Box sx={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${neutral[800]} 0%, ${neutral[700]} 100%)` }} />
          )}
        </Box>

        {isAvailable ? (
          <Box
            className="ep-play"
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: scrim(0.4),
              opacity: 0,
              transition: "opacity 200ms",
            }}
          >
            <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={20} color={neutral[950]} fill={neutral[950]} />
            </Box>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: `repeating-linear-gradient(135deg, transparent 0 8px, ${whiteAlpha(0.04)} 8px 9px)`,
                pointerEvents: "none",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                top: 6,
                right: 6,
                display: "flex",
                alignItems: "center",
                gap: 0.4,
                px: 0.7,
                py: 0.3,
                bgcolor: scrim(0.7),
                border: `1px solid ${whiteAlpha(0.12)}`,
                borderRadius: 0.75,
                fontFamily: fontFamily.mono,
                fontSize: "0.55rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: inkAlpha(0.85),
              }}
            >
              <Box component="span" aria-hidden sx={{ fontSize: "0.65rem", lineHeight: 1 }}>
                ✕
              </Box>
              {t("episode.unavailableShort")}
            </Box>
          </>
        )}

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
              bgcolor: whiteAlpha(0.2),
              "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
            }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, opacity: isAvailable ? 1 : 0.55 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mb: 0.25 }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
            {t("detail.episode", { number: episode.episode_number })}
          </Typography>
          <Typography variant="body2" fontWeight={500} noWrap sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
            {episode.title}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: "0.65rem", md: "0.7rem" } }}>
            {formatDuration(episode.duration_seconds)}
            {episode.air_date && ` | ${episode.air_date}`}
          </Typography>
          {langs.audio.length > 0 && (
            <Tooltip title={`${t("detail.audio")}: ${langs.audio.map(formatLanguage).join(", ")}`} arrow>
              <Chip label={langs.audio.map((l) => l.toUpperCase()).join(" · ")} size="small" sx={{ height: 16, fontSize: "0.55rem", bgcolor: whiteAlpha(0.08), color: "text.secondary" }} />
            </Tooltip>
          )}
          {langs.subtitle.length > 0 && (
            <Tooltip title={`${t("detail.subtitles")}: ${langs.subtitle.map(formatLanguage).join(", ")}`} arrow>
              <Chip label={`CC ${langs.subtitle.length}`} size="small" sx={{ height: 16, fontSize: "0.55rem", bgcolor: whiteAlpha(0.08), color: "text.secondary" }} />
            </Tooltip>
          )}
        </Box>
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
