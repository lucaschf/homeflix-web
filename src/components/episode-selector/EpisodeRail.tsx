import { useCallback, useEffect, useRef, useState } from "react";
import { Box, IconButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SeriesDetail } from "../../api/types";
import type { EpisodeSelectorView } from "../../hooks/useEpisodeSelector";
import { EpisodeRailCard } from "./EpisodeRailCard";
import { SeasonSelect } from "./SeasonSelect";
import { ViewToggle } from "./ViewToggle";
import {
  RAIL_CARD_WIDTH,
  RAIL_CARD_WIDTH_COMPACT,
  RAIL_GUTTER,
  episodeStateOf,
  episodeThumbnail,
  watchedCount,
} from "./state";

interface EpisodeRailProps {
  series: SeriesDetail;
  /** Season being browsed (not necessarily the one playing). */
  season: number;
  onSeasonChange: (season: number) => void;
  currentSeason: number;
  currentEpisode: number;
  /** Live position of the playing episode, 0-100. */
  playingPercent: number;
  view: EpisodeSelectorView;
  onViewChange: (view: EpisodeSelectorView) => void;
  onSelect: (season: number, episode: number) => void;
  onClose: () => void;
}

/**
 * Carrossel - the bottom rail of large landscape cards over the video.
 *
 * The Disney+ / Prime / Apple TV+ pattern: keeps the picture visible,
 * reads better on TV and touch, and is the mode to pick on a remote.
 * Weaker past ~20 episodes, which is what the list is for.
 *
 * Rendered inside the player's control bar so it shares the bottom
 * gradient and stays pinned while the selector is open.
 */
export function EpisodeRail({
  series,
  season,
  onSeasonChange,
  currentSeason,
  currentEpisode,
  playingPercent,
  view,
  onViewChange,
  onSelect,
  onClose,
}: EpisodeRailProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("sm"));
  const cardWidth = compact ? RAIL_CARD_WIDTH_COMPACT : RAIL_CARD_WIDTH;
  // Chevrons centre on the still, which the gutter pushes down.
  const arrowTop = RAIL_GUTTER + Math.round((cardWidth * 9) / 16) / 2;

  const scrollRef = useRef<HTMLDivElement>(null);
  const playingCardRef = useRef<HTMLButtonElement>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const seasonData =
    series.seasons.find((s) => s.season_number === season) ?? series.seasons[0];
  const episodes = seasonData?.episodes ?? [];
  const seasonNumber = seasonData?.season_number ?? season;
  const watched = watchedCount(seasonData);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // Arrow state has to survive a window resize as well as a season
  // swap: a shorter season can stop overflowing entirely.
  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateArrows, episodes.length, cardWidth]);

  // Auto-scroll to the playing episode on open and on season switch.
  // A season that isn't the one playing rewinds to its first card
  // rather than inheriting the previous season's offset.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const card = playingCardRef.current;
    const frame = requestAnimationFrame(() => {
      container.scrollLeft = card ? Math.max(0, card.offsetLeft - 24) : 0;
      updateArrows();
    });
    return () => cancelAnimationFrame(frame);
  }, [season, updateArrows]);

  // Escape dismisses the season dropdown first, then the rail. Capture
  // phase so the player's global shortcuts don't exit the player.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (seasonMenuOpen) setSeasonMenuOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose, seasonMenuOpen]);

  const page = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <Box sx={{ position: "relative", zIndex: 2, mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, md: 1.75 },
          mb: "13px",
        }}
      >
        <Typography
          variant="h3"
          color="overlayText.primary"
          sx={{ fontSize: 15, flexShrink: 0 }}
        >
          {t("player.episodes")}
        </Typography>
        {series.seasons.length > 0 && (
          <Box sx={{ width: 186, flexShrink: 0 }}>
            <SeasonSelect
              seasons={series.seasons}
              value={seasonNumber}
              onChange={onSeasonChange}
              open={seasonMenuOpen}
              onOpenChange={setSeasonMenuOpen}
            />
          </Box>
        )}
        <Typography
          variant="eyebrow"
          color="text.secondary"
          sx={{ fontSize: 10, letterSpacing: "1px", display: { xs: "none", md: "block" } }}
        >
          {t("player.episodeSelector.watchedOf", { watched, total: episodes.length })}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <ViewToggle value={view} onChange={onViewChange} compact={compact} />
        {/* The rail has no backdrop to click away, so it carries the
            same explicit dismiss the panel has (Escape and the
            toolbar button work here too). */}
        <IconButton
          onClick={onClose}
          size="small"
          aria-label={t("common.close")}
          sx={{ color: "text.secondary", flexShrink: 0 }}
        >
          <X size={17} />
        </IconButton>
      </Box>

      <Box
        sx={{
          position: "relative",
          mt: `-${RAIL_GUTTER}px`,
          mx: `-${RAIL_GUTTER}px`,
          "&:hover .scroll-btn": { opacity: 1 },
        }}
      >
        <Box
          ref={scrollRef}
          onScroll={updateArrows}
          role="listbox"
          aria-label={t("player.episodes")}
          sx={{
            display: "flex",
            gap: "18px",
            overflowX: "auto",
            // Breathing room for what a card paints outside its box —
            // the wrapper's negative margin cancels it, so the cards
            // still line up with the header above.
            pt: `${RAIL_GUTTER}px`,
            px: `${RAIL_GUTTER}px`,
            pb: "10px",
            scrollSnapType: "x mandatory",
            // Matches the gutter: a card snapped to the start must
            // leave room for its own outline, or the snap clips it.
            scrollPaddingLeft: `${RAIL_GUTTER}px`,
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {episodes.map((episode) => {
            const playing =
              seasonNumber === currentSeason &&
              episode.episode_number === currentEpisode;
            const state = episodeStateOf(episode, playing);
            return (
              <EpisodeRailCard
                key={episode.episode_number}
                episode={episode}
                state={state}
                thumbnail={episodeThumbnail(episode, series.poster_path)}
                percent={
                  playing
                    ? playingPercent
                    : state === "inProgress"
                      ? (episode.progress_percentage ?? 0)
                      : 0
                }
                width={cardWidth}
                cardRef={playing ? playingCardRef : undefined}
                onSelect={() => onSelect(seasonNumber, episode.episode_number)}
              />
            );
          })}
          {episodes.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 3, fontSize: 12.5 }}>
              {t("detail.noEpisodes")}
            </Typography>
          )}
        </Box>

        {/* Same chevrons as ``MediaCarousel`` / ``HorizontalScroller``
            — hidden until the row is hovered and gone at each end —
            but centred on the still rather than on the whole card, so
            they never sit over the title and synopsis. */}
        {canScrollLeft && (
          <IconButton
            className="scroll-btn"
            onClick={() => page(-1)}
            aria-label={t("common.scrollLeft")}
            sx={{
              position: "absolute",
              left: { xs: RAIL_GUTTER, md: RAIL_GUTTER + 8 },
              top: arrowTop,
              transform: "translateY(-50%)",
              zIndex: 3,
              color: "overlayText.secondary",
              opacity: 0,
              transition: "opacity 200ms",
              "&:hover": { color: "overlayText.primary", bgcolor: "transparent" },
            }}
          >
            <ChevronLeft size={32} />
          </IconButton>
        )}
        {canScrollRight && (
          <IconButton
            className="scroll-btn"
            onClick={() => page(1)}
            aria-label={t("common.scrollRight")}
            sx={{
              position: "absolute",
              right: { xs: RAIL_GUTTER, md: RAIL_GUTTER + 8 },
              top: arrowTop,
              transform: "translateY(-50%)",
              zIndex: 3,
              color: "overlayText.secondary",
              opacity: 0,
              transition: "opacity 200ms",
              "&:hover": { color: "overlayText.primary", bgcolor: "transparent" },
            }}
          >
            <ChevronRight size={32} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
