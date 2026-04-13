import { useState } from "react";
import { Box, IconButton, LinearProgress, Tooltip, Typography } from "@mui/material";
import { Bookmark, BookmarkCheck, ListPlus, Play, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsInWatchlist, useToggleWatchlist } from "../api/hooks";
import { AddToListDialog } from "./AddToListDialog";
import { neutral } from "../theme/colors";

interface MediaCardProps {
  title: string;
  imageUrl?: string;
  year?: number;
  progress?: number;
  /** Short label shown above the progress bar (e.g. "42 min left"). */
  progressLabel?: string;
  subtitle?: string;
  synopsis?: string;
  variant?: "poster" | "landscape" | "episode";
  fullWidth?: boolean;
  onClick?: () => void;
  /** When set, enables hover overlay with info and actions */
  mediaId?: string;
  mediaType?: "movie" | "series";
  onPlay?: () => void;
  /** When set, renders a dismiss (X) button on the card. Used by the
   *  "Continue Watching" row to let the user remove an item. */
  onDismiss?: () => void;
}

export function MediaCard({
  title,
  imageUrl,
  year,
  progress,
  progressLabel,
  subtitle,
  synopsis,
  variant = "poster",
  fullWidth = false,
  onClick,
  mediaId,
  mediaType,
  onPlay,
  onDismiss,
}: MediaCardProps) {
  const { t } = useTranslation();
  const aspectRatio = variant === "poster" ? "2/3" : "16/9";
  const hasActions = !!mediaId && !!mediaType;

  return (
    <Box
      sx={{
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        minWidth: 0,
        overflow: "hidden",
        borderRadius: 1,
        width: fullWidth ? "100%" : { xs: 140, sm: 200, md: 240, lg: 280 },
        "&:hover .media-image": { transform: "scale(1.05)" },
        "&:hover .card-hover-overlay": { opacity: 1 },
        // On hover: hide text; overlay covers entire card
        ...(hasActions && {
          "&:hover .card-text": { opacity: 0 },
        }),
        ...(!hasActions && {
          "&:hover .play-overlay": { opacity: 1 },
        }),
      }}
    >
      {/* Image */}
      <Box
        className={hasActions ? "card-image-wrapper" : undefined}
        onClick={onClick}
        sx={{
          position: "relative",
          aspectRatio,
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          mb: hasActions ? 0 : 0.5,
          transition: "all 250ms ease",
          zIndex: 0,
        }}
      >
        {imageUrl ? (
          <Box
            component="img"
            className="media-image"
            src={imageUrl}
            alt={title}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 250ms ease",
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t("card.noImage")}
            </Typography>
          </Box>
        )}

        {/* Dismiss button — shown on continue-watching cards */}
        {onDismiss && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              zIndex: 2,
              bgcolor: "rgba(0,0,0,0.6)",
              color: "#fff",
              p: 0.5,
              "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
            }}
          >
            <X size={14} />
          </IconButton>
        )}

        {/* Simple play overlay (no-actions cards only) */}
        {!hasActions && (
          <Box
            className="play-overlay"
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(0,0,0,0.4)",
              opacity: 0,
              transition: "opacity 200ms ease",
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play size={20} color={neutral[950]} fill={neutral[950]} />
            </Box>
          </Box>
        )}

        {/* Progress bar + remaining time label */}
        {progress !== undefined && progress > 0 && (
          <>
            {progressLabel && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  zIndex: 3,
                  bgcolor: "rgba(0,0,0,0.7)",
                  borderRadius: 0.75,
                  px: 0.75,
                  py: 0.25,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontSize: "0.6rem", fontWeight: 600, color: "common.white" }}
                >
                  {progressLabel}
                </Typography>
              </Box>
            )}
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 4,
                zIndex: 2,
                bgcolor: "rgba(255,255,255,0.2)",
                "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
              }}
            />
          </>
        )}
      </Box>

      {/* Title + Year — fades out on hover for action cards */}
      <Box
        className={hasActions ? "card-text" : undefined}
        onClick={onClick}
        sx={{
          transition: hasActions ? "opacity 250ms ease" : undefined,
          mt: 0.5,
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 500, color: "text.primary", fontSize: "0.8rem", lineHeight: 1.3 }}
        >
          {title}
        </Typography>
        {(subtitle || year) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.7rem" }}>
            {subtitle || year}
          </Typography>
        )}
      </Box>

      {/* Full-card hover overlay (covers image + title area) */}
      {hasActions && (
        <InfoOverlay
          title={title}
          synopsis={synopsis}
          year={year}
          mediaId={mediaId}
          mediaType={mediaType}
          onPlay={onPlay}
          onClick={onClick}
        />
      )}
    </Box>
  );
}

// ── Info Overlay (covers entire card on hover) ───────────

function InfoOverlay({
  title,
  synopsis,
  year,
  mediaId,
  mediaType,
  onPlay,
  onClick,
}: {
  title: string;
  synopsis?: string;
  year?: number;
  mediaId: string;
  mediaType: "movie" | "series";
  onPlay?: () => void;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const { data: inWatchlist } = useIsInWatchlist(mediaId);
  const toggleWatchlist = useToggleWatchlist();
  const [addToListOpen, setAddToListOpen] = useState(false);

  return (
    <>
      <Box
        className="card-hover-overlay"
        onClick={onClick}
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0.35) 100%)",
          opacity: 0,
          transition: "opacity 250ms ease",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        {/* Info content */}
        <Box sx={{ p: 1.5 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontSize: "0.85rem", lineHeight: 1.3 }}
            noWrap
          >
            {title}
          </Typography>

          {year && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
              {year}
            </Typography>
          )}

          {synopsis && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: { xs: 2, sm: 3, md: 4, lg: 6 },
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                mt: 0.5,
                fontSize: "0.65rem",
                lineHeight: 1.4,
              }}
            >
              {synopsis}
            </Typography>
          )}

          {/* Action buttons — accent-colored icons, no background */}
          <Box
            sx={{ display: "flex", gap: 0.5, mt: 1.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            {onPlay && (
              <Tooltip title={t("card.play")} arrow>
                <IconButton size="small" onClick={onPlay} sx={{ color: "primary.main" }}>
                  <Play size={18} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={inWatchlist ? t("card.removeFromWatchlist") : t("card.addToWatchlist")} arrow>
              <IconButton
                size="small"
                onClick={() => toggleWatchlist.mutate({ media_id: mediaId, media_type: mediaType })}
                sx={{ color: "primary.main" }}
              >
                {inWatchlist ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              </IconButton>
            </Tooltip>

            <Tooltip title={t("card.addToList")} arrow>
              <IconButton
                size="small"
                onClick={() => setAddToListOpen(true)}
                sx={{ color: "primary.main" }}
              >
                <ListPlus size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <AddToListDialog
        open={addToListOpen}
        onClose={() => setAddToListOpen(false)}
        mediaId={mediaId}
        mediaType={mediaType}
      />
    </>
  );
}
