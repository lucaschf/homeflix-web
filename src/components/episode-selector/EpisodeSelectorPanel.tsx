import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SeriesDetail } from "../../api/types";
import type { EpisodeSelectorView } from "../../hooks/useEpisodeSelector";
import { fontFamily, panelScrim, scrim, whiteAlpha } from "../../theme/tokens";
import { EpisodeListRow } from "./EpisodeListRow";
import { SeasonSelect } from "./SeasonSelect";
import { ViewToggle } from "./ViewToggle";
import {
  PANEL_WIDTH,
  episodeStateOf,
  episodeThumbnail,
  watchedCount,
} from "./state";

interface EpisodeSelectorPanelProps {
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
 * Lista - the right-hand side panel, one episode per row.
 *
 * The Netflix / Max pattern: dense, scannable by number, and the whole
 * season is a scroll away. Opens scrolled to the playing episode.
 */
export function EpisodeSelectorPanel({
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
}: EpisodeSelectorPanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playingRowRef = useRef<HTMLButtonElement>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);

  const seasonData =
    series.seasons.find((s) => s.season_number === season) ?? series.seasons[0];
  const episodes = seasonData?.episodes ?? [];
  const watched = watchedCount(seasonData);

  // Escape dismisses the topmost surface: the season dropdown first,
  // the panel second. Capture phase so the player's own global
  // shortcut handler doesn't exit the player out from under it.
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

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Auto-scroll to the playing episode on open and on season switch -
  // 100px of lead-in keeps it off the very top edge. A season that
  // isn't the one playing starts at its first episode instead of
  // keeping the previous season's scroll offset.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const row = playingRowRef.current;
    container.scrollTop = row ? Math.max(0, row.offsetTop - 100) : 0;
  }, [season]);

  const seasonNumber = seasonData?.season_number ?? season;

  return (
    <>
      <Box
        onClick={onClose}
        sx={{ position: "absolute", inset: 0, bgcolor: scrim(0.45), zIndex: 19 }}
      />

      <Box
        ref={panelRef}
        role="dialog"
        aria-label={t("player.episodes")}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          width: { xs: "100%", sm: PANEL_WIDTH },
          display: "flex",
          flexDirection: "column",
          bgcolor: panelScrim(0.97),
          backdropFilter: "blur(20px)",
          borderLeft: `1px solid ${whiteAlpha(0.08)}`,
          outline: "none",
          "@keyframes homeflixPanelIn": {
            from: { transform: "translateX(24px)", opacity: 0 },
            to: { transform: "none", opacity: 1 },
          },
          animation: "homeflixPanelIn 280ms ease",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "13px",
            p: "18px 18px 14px",
            borderBottom: `1px solid ${whiteAlpha(0.08)}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h3" color="overlayText.primary" sx={{ fontSize: 16.5 }}>
                {series.title}
              </Typography>
              <Typography
                variant="eyebrow"
                color="text.secondary"
                sx={{ display: "block", mt: "5px", fontSize: 10, letterSpacing: "1px" }}
              >
                {t("player.episodeSelector.watchedOf", {
                  watched,
                  total: episodes.length,
                })}
                {seasonNumber > 0
                  ? ` · ${t("player.episodeSelector.seasonShort", { number: seasonNumber })}`
                  : ""}
              </Typography>
              <Box
                sx={{
                  height: 2,
                  mt: "8px",
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: whiteAlpha(0.09),
                }}
              >
                <Box
                  sx={{
                    width: `${episodes.length ? (watched / episodes.length) * 100 : 0}%`,
                    height: "100%",
                    bgcolor: "primary.main",
                    transition: "width 200ms",
                  }}
                />
              </Box>
            </Box>
            <IconButton
              onClick={onClose}
              size="small"
              aria-label={t("common.close")}
              sx={{ color: "text.secondary" }}
            >
              <X size={17} />
            </IconButton>
          </Box>

          <ViewToggle value={view} onChange={onViewChange} />

          {series.seasons.length > 0 && (
            <SeasonSelect
              seasons={series.seasons}
              value={seasonNumber}
              onChange={onSeasonChange}
              open={seasonMenuOpen}
              onOpenChange={setSeasonMenuOpen}
            />
          )}
        </Box>

        <Box
          ref={scrollRef}
          role="listbox"
          aria-label={t("player.episodes")}
          sx={{ flex: 1, position: "relative", overflowY: "auto", pb: "14px" }}
        >
          {episodes.map((episode) => {
            const playing =
              seasonNumber === currentSeason &&
              episode.episode_number === currentEpisode;
            const state = episodeStateOf(episode, playing);
            return (
              <EpisodeListRow
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
                rowRef={playing ? playingRowRef : undefined}
                onSelect={() => onSelect(seasonNumber, episode.episode_number)}
              />
            );
          })}
          {episodes.length === 0 && (
            <Typography
              color="text.secondary"
              sx={{ p: "26px 18px", fontSize: 12.5, fontFamily: fontFamily.mono }}
            >
              {t("detail.noEpisodes")}
            </Typography>
          )}
        </Box>
      </Box>
    </>
  );
}
