import { useState, type RefObject } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { EpisodeOutput } from "../../api/types";
import { fontFamily, inkAlpha, peachAlpha, whiteAlpha } from "../../theme/tokens";
import { formatDuration } from "../../utils/duration";
import { EpisodeThumb } from "./EpisodeThumb";
import { LIST_THUMB_WIDTH, SYNOPSIS_LINE_HEIGHT, type EpisodeState } from "./state";

interface EpisodeListRowProps {
  episode: EpisodeOutput;
  state: EpisodeState;
  thumbnail: string | null;
  /** Progress 0–100 on the thumbnail (live position for the playing one). */
  percent: number;
  onSelect: () => void;
  /** Set on the playing row so the panel can scroll it into view. */
  rowRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * One episode as a panel row, in the Netflix / Max anatomy:
 * `number column | large thumbnail | title + duration / synopsis`.
 *
 * The number column and the 149x84 still are the scanning
 * affordances; the synopsis is secondary and sits in a
 * height-reserved slot so nothing reflows under the cursor.
 */
export function EpisodeListRow({
  episode,
  state,
  thumbnail,
  percent,
  onSelect,
  rowRef,
}: EpisodeListRowProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const playing = state === "playing";
  // A watched row stays quiet — until it's hovered, where it lights up
  // like any other target.
  const dim = state === "watched" && !hovered;

  return (
    <Box
      component="button"
      type="button"
      ref={rowRef}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={playing ? "true" : undefined}
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: "13px",
        width: "100%",
        p: "13px 16px 13px 14px",
        border: "none",
        textAlign: "left",
        font: "inherit",
        cursor: "pointer",
        bgcolor: playing
          ? peachAlpha(0.1)
          : hovered
            ? whiteAlpha(0.05)
            : "transparent",
        transition: "background 130ms",
      }}
    >
      {playing && (
        <Box
          sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, bgcolor: "primary.main" }}
        />
      )}

      <Box
        component="span"
        sx={{
          width: 16,
          flexShrink: 0,
          pt: "31px",
          textAlign: "center",
          fontFamily: fontFamily.mono,
          fontSize: 12,
          color: playing ? "primary.main" : inkAlpha(dim ? 0.35 : 0.55),
        }}
      >
        {episode.episode_number}
      </Box>

      <EpisodeThumb
        src={thumbnail}
        state={state}
        width={LIST_THUMB_WIDTH}
        radius={6}
        hovered={hovered}
        percent={percent}
      />

      <Box
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Box component="span" sx={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                fontSize: 13.5,
                lineHeight: 1.32,
                fontWeight: playing ? 600 : 500,
                color: playing
                  ? "primary.main"
                  : dim
                    ? inkAlpha(0.62)
                    : "overlayText.primary",
                textWrap: "pretty",
              }}
            >
              {episode.title}
            </Box>
          </Box>
          <Box
            component="span"
            sx={{
              flexShrink: 0,
              fontFamily: fontFamily.mono,
              fontSize: 10.5,
              color: inkAlpha(0.5),
            }}
          >
            {formatDuration(episode.duration_seconds)}
          </Box>
        </Box>

        {playing && (
          <Box
            component="span"
            sx={{
              mt: "4px",
              fontFamily: fontFamily.mono,
              fontSize: 9.5,
              letterSpacing: "1.1px",
              textTransform: "uppercase",
              color: "primary.main",
            }}
          >
            {t("player.episodeSelector.nowPlaying", { percent })}
          </Box>
        )}

        {/* Height-reserved: the synopsis slot keeps its box whether or
            not there's text, so hover can never shift rows. */}
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
              fontSize: 11.5,
              lineHeight: `${SYNOPSIS_LINE_HEIGHT}px`,
              color: "text.secondary",
              textWrap: "pretty",
            }}
          >
            {episode.synopsis ?? ""}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
