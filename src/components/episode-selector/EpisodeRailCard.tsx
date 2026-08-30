import { useState, type RefObject } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { EpisodeOutput } from "../../api/types";
import { fontFamily, inkAlpha } from "../../theme/tokens";
import { formatDuration } from "../../utils/duration";
import { EpisodeThumb } from "./EpisodeThumb";
import { SYNOPSIS_LINE_HEIGHT, type EpisodeState } from "./state";

interface EpisodeRailCardProps {
  episode: EpisodeOutput;
  state: EpisodeState;
  thumbnail: string | null;
  /** Progress 0–100 on the thumbnail (live position for the playing one). */
  percent: number;
  /** Card width in px; the still is width x 9/16. */
  width: number;
  onSelect: () => void;
  /** Set on the playing card so the rail can scroll it into view. */
  cardRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * One episode as a rail card, in the Disney+ / Prime / Apple TV+
 * anatomy: a large landscape still with the number, title and
 * duration on one line underneath and a two-line synopsis below.
 *
 * The playing card takes a peach outline instead of the list's left
 * bar — there's no row edge to hang a bar on.
 */
export function EpisodeRailCard({
  episode,
  state,
  thumbnail,
  percent,
  width,
  onSelect,
  cardRef,
}: EpisodeRailCardProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const playing = state === "playing";
  const dim = state === "watched" && !hovered;

  return (
    <Box
      component="button"
      type="button"
      ref={cardRef}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={playing ? "true" : undefined}
      sx={{
        flexShrink: 0,
        width,
        p: 0,
        border: "none",
        bgcolor: "transparent",
        textAlign: "left",
        font: "inherit",
        cursor: "pointer",
        scrollSnapAlign: "start",
        transform: hovered ? "translateY(-4px)" : "none",
        transition: "transform 160ms",
      }}
    >
      <Box
        component="span"
        sx={{
          display: "block",
          borderRadius: "9px",
          outline: `2px solid ${playing ? "currentColor" : "transparent"}`,
          outlineOffset: "2px",
          color: "primary.main",
          transition: "outline-color 150ms",
        }}
      >
        <EpisodeThumb
          src={thumbnail}
          state={state}
          width={width}
          radius={9}
          hovered={hovered}
          percent={percent}
        />
      </Box>

      <Box
        component="span"
        sx={{ display: "flex", alignItems: "baseline", gap: "8px", mt: "11px" }}
      >
        <Box
          component="span"
          sx={{
            fontFamily: fontFamily.mono,
            fontSize: 11.5,
            color: playing ? "primary.main" : inkAlpha(0.55),
          }}
        >
          {String(episode.episode_number).padStart(2, "0")}
        </Box>
        <Box
          component="span"
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 14,
            fontWeight: playing ? 600 : 500,
            color: playing
              ? "primary.main"
              : dim
                ? inkAlpha(0.62)
                : "overlayText.primary",
          }}
        >
          {episode.title}
        </Box>
        <Box
          component="span"
          sx={{ fontFamily: fontFamily.mono, fontSize: 10.5, color: inkAlpha(0.45) }}
        >
          {formatDuration(episode.duration_seconds)}
        </Box>
      </Box>

      {playing ? (
        <Box
          component="span"
          sx={{
            display: "block",
            mt: "5px",
            minHeight: SYNOPSIS_LINE_HEIGHT * 2,
            fontFamily: fontFamily.mono,
            fontSize: 9.5,
            lineHeight: `${SYNOPSIS_LINE_HEIGHT}px`,
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            color: "primary.main",
          }}
        >
          {t("player.episodeSelector.nowPlaying", { percent })}
        </Box>
      ) : (
        <Box
          component="span"
          sx={{ display: "block", mt: "5px", minHeight: SYNOPSIS_LINE_HEIGHT * 2 }}
        >
          <Box
            component="span"
            sx={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              fontSize: 12,
              lineHeight: `${SYNOPSIS_LINE_HEIGHT}px`,
              color: "text.secondary",
              textWrap: "pretty",
            }}
          >
            {episode.synopsis ?? ""}
          </Box>
        </Box>
      )}
    </Box>
  );
}
