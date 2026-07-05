import { useEffect, useRef, useState } from "react";
import { Box, LinearProgress, Tooltip, Typography } from "@mui/material";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEpisodeScrubFrame } from "../hooks/useEpisodeScrubFrame";
import type { EpisodeOutput } from "../api/types";
import { neutral } from "../theme/colors";
import { fontFamily, inkAlpha, scrim, whiteAlpha } from "../theme/tokens";
import { formatDuration } from "../utils/duration";

interface EpisodeCardProps {
  episode: EpisodeOutput;
  seriesId: string;
  seasonNumber: number;
  seriesPoster: string | null;
  onPlay: () => void;
  /** Fill the parent's width instead of the fixed carousel width.
   *  Used by the grid view, where a MUI ``Grid`` cell owns the
   *  responsive column width. */
  fullWidth?: boolean;
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
  fullWidth = false,
}: EpisodeCardProps) {
  const { t } = useTranslation();
  const duration = formatDuration(episode.duration_seconds);
  // An episode that exists in the catalog (TMDB enrichment populated
  // title/duration/synopsis) but has no file on disk yet. Common after
  // a Movie→Series promotion that creates the full TMDB shape while
  // only the first part has a local file, or for series where the
  // user hasn't downloaded every episode.
  const isAvailable = (episode.files?.length ?? 0) > 0;

  // Only fetch the VTT when there's no real per-episode thumbnail and
  // the backend has actually generated a scrub sprite for the file.
  // Skips the request entirely otherwise so a season of 24 episodes
  // doesn't fire 24 wasted fetches. Missing-file episodes have no
  // scrub sprite either, so guarding on availability keeps the hook
  // from firing for them too.
  const scrubFrame = useEpisodeScrubFrame({
    seriesId,
    seasonNumber,
    episodeNumber: episode.episode_number,
    durationSeconds: episode.duration_seconds,
    enabled: isAvailable && !episode.thumbnail_path && !!episode.scrub_preview_path,
  });

  const cardBody = (
    <Box
      role={isAvailable ? "button" : undefined}
      tabIndex={isAvailable ? 0 : -1}
      aria-disabled={isAvailable ? undefined : true}
      onClick={isAvailable ? onPlay : undefined}
      onKeyDown={
        isAvailable
          ? (e) => {
              // Activate on Enter / Space — the same affordance native
              // <button> elements give for keyboard and screen-reader
              // users. preventDefault on Space stops the page from
              // scrolling when the card is focused.
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPlay();
              }
            }
          : undefined
      }
      sx={{
        flex: "0 0 auto",
        // 16:9 landscape card, one step smaller than the Continue
        // Watching card (MediaCard variant="landscape") so the episode
        // list stays denser while sharing the same visual language. In
        // the grid view the card fills the MUI Grid cell instead.
        width: fullWidth ? "100%" : { xs: 210, sm: 280, md: 320, lg: 380 },
        cursor: isAvailable ? "pointer" : "default",
        "&:hover .ep-card-thumb": isAvailable ? { transform: "scale(1.03)" } : {},
        "&:hover .ep-play-overlay": isAvailable ? { opacity: 1 } : {},
        "&:focus-visible": isAvailable
          ? {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
              borderRadius: 8,
            }
          : {},
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
            // De-saturate the thumbnail when the episode has no
            // playable file — same visual idiom Collection uses for
            // titles not in the catalog.
            filter: isAvailable ? "none" : "grayscale(1)",
            opacity: isAvailable ? 1 : 0.55,
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
                background: `linear-gradient(135deg, ${neutral[800]} 0%, ${neutral[700]} 100%)`,
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
            bgcolor: scrim(0.65),
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
              bgcolor: scrim(0.65),
              color: "common.white",
              fontSize: "0.7rem",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {duration}
          </Box>
        )}

        {isAvailable ? (
          <Box
            className="ep-play-overlay"
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
        ) : (
          // Reuses the Collection-style missing affordance: diagonal
          // stripe texture across the thumbnail plus a pill badge so
          // the state reads clearly even at carousel-card sizes.
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
                top: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 0.85,
                py: 0.4,
                bgcolor: scrim(0.7),
                border: `1px solid ${whiteAlpha(0.12)}`,
                borderRadius: 0.75,
                fontFamily: fontFamily.mono,
                fontSize: "0.6rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: inkAlpha(0.85),
              }}
            >
              <Box component="span" aria-hidden sx={{ fontSize: "0.7rem", lineHeight: 1 }}>
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

      <Box sx={{ mt: 1.5, opacity: isAvailable ? 1 : 0.55 }}>
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

  // The "missing" tooltip explains the badge for users mousing over
  // the card; available episodes render the body bare so the existing
  // hover overlay isn't obscured by a tooltip.
  return isAvailable ? (
    cardBody
  ) : (
    <Tooltip title={t("episode.unavailableTooltip")} placement="top">
      {cardBody}
    </Tooltip>
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
