import { Box } from "@mui/material";
import { Check, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { neutral } from "../../theme/colors";
import { inkAlpha, scrim } from "../../theme/tokens";
import type { EpisodeState } from "./state";

interface EpisodeThumbProps {
  src: string | null;
  state: EpisodeState;
  /** Rendered width in px — the height follows from the 16:9 ratio. */
  width: number;
  /** Corner radius in px (6 in the list, 9 on a rail card). */
  radius: number;
  /** Owned by the row/card so the whole surface shares one hover. */
  hovered: boolean;
  /** Watch progress 0–100, painted over the bottom 3px. */
  percent: number;
}

/**
 * The 16:9 still that carries the whole state language: dimmed with a
 * quiet check when watched, an animated equalizer while playing, a
 * peach progress bar when part-way through, and a white play disc on
 * hover.
 *
 * Note this deliberately does *not* use ``WatchedBadge`` — that badge
 * is a loud peach disc, right for the series page where a check is the
 * only marker, wrong here where 13 of them shouted over each other.
 */
export function EpisodeThumb({
  src,
  state,
  width,
  radius,
  hovered,
  percent,
}: EpisodeThumbProps) {
  const { t } = useTranslation();
  const height = Math.round((width * 9) / 16);
  const watched = state === "watched";
  const playing = state === "playing";
  const discSize = Math.round(height * 0.36);

  return (
    <Box
      sx={{
        position: "relative",
        width,
        height,
        flexShrink: 0,
        borderRadius: `${radius}px`,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${neutral[800]} 0%, ${neutral[900]} 100%)`,
      }}
    >
      {src && (
        <Box
          component="img"
          src={src}
          alt=""
          loading="lazy"
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}

      {/* Watched recedes rather than shouts: half-dim the still. */}
      {watched && <Box sx={{ position: "absolute", inset: 0, bgcolor: scrim(0.5) }} />}

      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          bgcolor: hovered ? scrim(0.42) : "transparent",
          transition: "background 150ms",
        }}
      >
        {playing ? (
          <Box
            aria-hidden
            sx={{
              display: "flex",
              alignItems: "flex-end",
              gap: "2.5px",
              height: 14,
              "@keyframes homeflixEqualizer": {
                "0%, 100%": { height: 4 },
                "50%": { height: 12 },
              },
            }}
          >
            {[0, 0.15, 0.3].map((delay) => (
              <Box
                key={delay}
                component="span"
                sx={{
                  width: 2,
                  height: 4,
                  borderRadius: "1px",
                  bgcolor: "primary.main",
                  animation: "homeflixEqualizer 0.9s ease-in-out infinite",
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </Box>
        ) : hovered ? (
          <Box
            aria-hidden
            sx={{
              width: discSize,
              height: discSize,
              borderRadius: "50%",
              bgcolor: inkAlpha(0.92),
              display: "grid",
              placeItems: "center",
            }}
          >
            <Play
              size={Math.round(discSize * 0.44)}
              color={neutral[950]}
              fill={neutral[950]}
            />
          </Box>
        ) : null}
      </Box>

      {percent > 0 && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            bgcolor: scrim(0.55),
          }}
        >
          <Box
            sx={{
              width: `${Math.min(100, percent)}%`,
              height: "100%",
              bgcolor: "primary.main",
            }}
          />
        </Box>
      )}

      {watched && (
        <Box
          role="img"
          aria-label={t("episode.watched")}
          sx={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 16,
            height: 16,
            borderRadius: "50%",
            bgcolor: scrim(0.72),
            display: "grid",
            placeItems: "center",
          }}
        >
          <Check size={9} strokeWidth={2.6} color={inkAlpha(0.9)} />
        </Box>
      )}
    </Box>
  );
}
