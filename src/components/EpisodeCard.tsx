import { useEffect, useRef, useState } from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import { Play } from "lucide-react";
import { useEpisodeScrubFrame } from "../hooks/useEpisodeScrubFrame";
import type { EpisodeOutput } from "../api/types";
import { neutral } from "../theme/colors";
import { formatDuration } from "../utils/duration";

interface EpisodeCardProps {
  episode: EpisodeOutput;
  seriesId: string;
  seasonNumber: number;
  seriesPoster: string | null;
  onPlay: () => void;
}

/**
 * Apple-TV-style episode card: large 16:9 thumbnail with title and
 * synopsis stacked below. Used by the carousel-style episode list
 * (toggle on the series detail page).
 *
 * Thumbnail fallback chain mirrors the compact ``EpisodeRow`` plus
 * a scrub-preview frame so episodes without a first-class
 * ``thumbnail_path`` still get a representative still:
 * ``thumbnail_path`` → scrub-preview frame → series poster → gradient.
 */
export function EpisodeCard({
  episode,
  seriesId,
  seasonNumber,
  seriesPoster,
  onPlay,
}: EpisodeCardProps) {
  const duration = formatDuration(episode.duration_seconds);

  // Only fetch the VTT when there's no real per-episode thumbnail and
  // the backend has actually generated a scrub sprite for the file.
  // Skips the request entirely otherwise so a season of 24 episodes
  // doesn't fire 24 wasted fetches.
  const scrubFrame = useEpisodeScrubFrame({
    seriesId,
    seasonNumber,
    episodeNumber: episode.episode_number,
    durationSeconds: episode.duration_seconds,
    enabled: !episode.thumbnail_path && !!episode.scrub_preview_path,
  });

  return (
    <Box
      onClick={onPlay}
      sx={{
        flex: "0 0 auto",
        width: { xs: 220, sm: 260, md: 300 },
        cursor: "pointer",
        "&:hover .ep-card-thumb": { transform: "scale(1.03)" },
        "&:hover .ep-play-overlay": { opacity: 1 },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        <Box
          className="ep-card-thumb"
          sx={{
            position: "absolute",
            inset: 0,
            transition: "transform 250ms ease",
          }}
        >
          {episode.thumbnail_path ? (
            <Box
              component="img"
              src={episode.thumbnail_path}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : scrubFrame ? (
            <ScrubFrameThumbnail frame={scrubFrame} />
          ) : seriesPoster ? (
            <Box
              component="img"
              src={seriesPoster}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)",
              }}
            />
          )}
        </Box>

        {/* Top-left: episode number badge — anchors the eye to the
            position of the episode in the season at a glance.
            Bottom-right: runtime badge so the user can plan their
            watch session without inspecting the row text. The
            bottom anchor sits 12px above the lower edge so the
            in-progress LinearProgress (3px tall, anchored to the
            bottom) never overlaps it. */}
        <Box
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: "rgba(0,0,0,0.65)",
            color: "common.white",
            fontSize: "0.7rem",
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          E{episode.episode_number}
        </Box>
        {duration && (
          <Box
            sx={{
              position: "absolute",
              bottom: 12,
              right: 8,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: "rgba(0,0,0,0.65)",
              color: "common.white",
              fontSize: "0.7rem",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {duration}
          </Box>
        )}

        <Box
          className="ep-play-overlay"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.4)",
            opacity: 0,
            transition: "opacity 200ms",
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={22} color={neutral[950]} fill={neutral[950]} />
          </Box>
        </Box>

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
              bgcolor: "rgba(255,255,255,0.2)",
              "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
            }}
          />
        )}
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {episode.title}
        </Typography>
        {episode.synopsis && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              mt: 0.5,
              lineHeight: 1.4,
            }}
          >
            {episode.synopsis}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * Render a single tile of the scrub-preview sprite as a thumbnail.
 *
 * The sprite is a grid of small frames (e.g. 160×90); we want the
 * tile at ``(frame.x, frame.y)`` to fill a card-sized container. We
 * read the container width via ``ResizeObserver`` and apply
 * ``transform: scale(s) translate(-x, -y)`` to the natural-sized
 * sprite so the browser composites the slice without re-rasterizing.
 *
 * The transform is right-to-left: translate applies first, sliding
 * the desired tile to ``(0, 0)``, then scale wraps the result so the
 * tile fills the parent's 16:9 box.
 */
function ScrubFrameThumbnail({
  frame,
}: {
  frame: { spriteUrl: string; x: number; y: number; width: number; height: number };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      if (frame.width > 0) setScale(el.clientWidth / frame.width);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [frame.width]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {scale > 0 && (
        <Box
          component="img"
          src={frame.spriteUrl}
          alt=""
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            transformOrigin: "top left",
            transform: `scale(${scale}) translate(${-frame.x}px, ${-frame.y}px)`,
          }}
        />
      )}
    </Box>
  );
}
