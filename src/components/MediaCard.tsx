import { useState } from "react";
import { Box, IconButton, LinearProgress, Tooltip, Typography } from "@mui/material";
import { Bookmark, BookmarkCheck, ListPlus, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsInWatchlist, useToggleWatchlist } from "../api/hooks";
import { AddToListDialog } from "./AddToListDialog";

interface MediaCardProps {
  title: string;
  imageUrl?: string;
  year?: number;
  progress?: number;
  subtitle?: string;
  synopsis?: string;
  variant?: "poster" | "landscape" | "episode";
  fullWidth?: boolean;
  onClick?: () => void;
  /** When set, enables expanded hover card with actions */
  mediaId?: string;
  mediaType?: "movie" | "series";
  onPlay?: () => void;
}

export function MediaCard({
  title,
  imageUrl,
  year,
  progress,
  subtitle,
  synopsis,
  variant = "poster",
  fullWidth = false,
  onClick,
  mediaId,
  mediaType,
  onPlay,
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
        width: fullWidth ? "100%" : { xs: 140, sm: 200, md: 240, lg: 280 },
        // When hoverable, scale up and show info panel
        ...(hasActions && {
          "&:hover": {
            zIndex: 10,
            "& .hover-card": { opacity: 1, visibility: "visible", transform: "scale(1)" },
          },
        }),
        // Simple hover for cards without actions
        ...(!hasActions && {
          "&:hover .media-image": { transform: "scale(1.05)" },
          "&:hover .play-overlay": { opacity: 1 },
        }),
      }}
    >
      {/* Base card (always visible) */}
      <Box onClick={onClick}>
        <Box
          sx={{
            position: "relative",
            aspectRatio,
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "background.paper",
            mb: 0.5,
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
                <Play size={20} color="#0D0D0D" fill="#0D0D0D" />
              </Box>
            </Box>
          )}

          {/* Progress bar */}
          {progress !== undefined && progress > 0 && (
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 4,
                bgcolor: "rgba(255,255,255,0.2)",
                "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
              }}
            />
          )}
        </Box>

        {/* Title */}
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 500, color: "text.primary", fontSize: "0.8rem", lineHeight: 1.3 }}
        >
          {title}
        </Typography>

        {/* Subtitle / Year */}
        {(subtitle || year) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.7rem" }}>
            {subtitle || year}
          </Typography>
        )}
      </Box>

      {/* Expanded hover card (Crunchyroll-style) */}
      {hasActions && (
        <HoverCard
          title={title}
          synopsis={synopsis}
          year={year}
          imageUrl={imageUrl}
          mediaId={mediaId}
          mediaType={mediaType}
          onPlay={onPlay}
          onClick={onClick}
        />
      )}
    </Box>
  );
}

// ── Hover Card (expands on hover, Crunchyroll-style) ─────

function HoverCard({
  title,
  synopsis,
  year,
  imageUrl,
  mediaId,
  mediaType,
  onPlay,
  onClick,
}: {
  title: string;
  synopsis?: string;
  year?: number;
  imageUrl?: string;
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
        className="hover-card"
        sx={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: "110%",
          transform: "scale(0.95)",
          transformOrigin: "top center",
          marginLeft: "-55%",
          opacity: 0,
          visibility: "hidden",
          transition: "opacity 200ms ease, transform 200ms ease",
          zIndex: 10,
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "#1A1A1A",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* Image */}
        <Box
          onClick={onClick}
          sx={{ position: "relative", aspectRatio: "2/3", cursor: "pointer" }}
        >
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={title}
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
          {/* Gradient fade at bottom */}
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "40%",
              background: "linear-gradient(transparent, #1A1A1A)",
            }}
          />
        </Box>

        {/* Info panel */}
        <Box sx={{ p: 1.5, pt: 0, mt: -4, position: "relative" }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontSize: "0.85rem", mb: 0.25, lineHeight: 1.3 }}
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
                WebkitLineClamp: 3,
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

          {/* Action buttons */}
          <Box
            sx={{ display: "flex", gap: 0.75, mt: 1.5, justifyContent: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            {onPlay && (
              <Tooltip title={t("card.play")} arrow>
                <IconButton
                  size="small"
                  onClick={onPlay}
                  sx={{
                    bgcolor: "primary.main",
                    color: "#0D0D0D",
                    "&:hover": { bgcolor: "primary.dark" },
                    width: 34,
                    height: 34,
                  }}
                >
                  <Play size={16} fill="#0D0D0D" />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={inWatchlist ? t("card.removeFromWatchlist") : t("card.addToWatchlist")} arrow>
              <IconButton
                size="small"
                onClick={() => toggleWatchlist.mutate({ media_id: mediaId, media_type: mediaType })}
                sx={{
                  bgcolor: "rgba(255,255,255,0.1)",
                  color: inWatchlist ? "primary.main" : "#fff",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                  width: 34,
                  height: 34,
                }}
              >
                {inWatchlist ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </IconButton>
            </Tooltip>

            <Tooltip title={t("card.addToList")} arrow>
              <IconButton
                size="small"
                onClick={() => setAddToListOpen(true)}
                sx={{
                  bgcolor: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                  width: 34,
                  height: 34,
                }}
              >
                <ListPlus size={16} />
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
