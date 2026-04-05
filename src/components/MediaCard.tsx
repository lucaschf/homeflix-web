import { Box, LinearProgress, Typography } from "@mui/material";
import { Play } from "lucide-react";

interface MediaCardProps {
  title: string;
  posterUrl?: string;
  year?: number;
  progress?: number;
  subtitle?: string;
  variant?: "poster" | "episode";
  onClick?: () => void;
}

export function MediaCard({
  title,
  posterUrl,
  year,
  progress,
  subtitle,
  variant = "poster",
  onClick,
}: MediaCardProps) {
  const isPoster = variant === "poster";
  const aspectRatio = isPoster ? "2/3" : "16/9";

  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: "pointer",
        flexShrink: 0,
        width: isPoster
          ? { xs: 130, sm: 150, md: 170 }
          : { xs: 240, sm: 280, md: 320 },
        "&:hover .media-image": {
          transform: "scale(1.05)",
        },
        "&:hover .play-overlay": {
          opacity: 1,
        },
      }}
    >
      {/* Image Container */}
      <Box
        sx={{
          position: "relative",
          aspectRatio,
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "background.paper",
          mb: 1,
        }}
      >
        {posterUrl ? (
          <Box
            component="img"
            className="media-image"
            src={posterUrl}
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
            <Typography variant="body2" color="text.tertiary">
              No Image
            </Typography>
          </Box>
        )}

        {/* Play overlay on hover */}
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
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={24} color="#0D0D0D" fill="#0D0D0D" />
          </Box>
        </Box>

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
              height: 3,
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
        sx={{ fontWeight: 500, color: "text.primary" }}
      >
        {title}
      </Typography>

      {/* Subtitle / Year */}
      {(subtitle || year) && (
        <Typography variant="caption" color="text.secondary" noWrap>
          {subtitle || year}
        </Typography>
      )}
    </Box>
  );
}
