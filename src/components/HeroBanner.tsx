import { Box, Button, Chip, Typography } from "@mui/material";
import { Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeroBannerProps {
  title: string;
  synopsis?: string;
  year?: number;
  duration?: string;
  genres?: string[];
  backdropUrl?: string;
  onPlay?: () => void;
  onAddToList?: () => void;
}

export function HeroBanner({
  title,
  synopsis,
  year,
  duration,
  genres = [],
  backdropUrl,
  onPlay,
  onAddToList,
}: HeroBannerProps) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: { xs: 400, sm: 480, md: 560 },
        overflow: "hidden",
      }}
    >
      {/* Backdrop Image */}
      {backdropUrl && (
        <Box
          component="img"
          src={backdropUrl}
          alt=""
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* Gradient Overlays */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.6) 40%, transparent 70%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.3) 30%, transparent 50%)",
        }}
      />

      {/* Content */}
      <Box
        sx={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          px: { xs: 3, md: 6 },
          pb: { xs: 4, md: 6 },
          maxWidth: 600,
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: "1.75rem", md: "2.25rem" },
            fontWeight: 700,
            mb: 1,
          }}
        >
          {title}
        </Typography>

        {/* Metadata row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
          {year && (
            <Typography variant="body2" color="text.secondary">
              {year}
            </Typography>
          )}
          {duration && (
            <>
              <Typography variant="body2" color="text.secondary">
                |
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {duration}
              </Typography>
            </>
          )}
          {genres.map((genre) => (
            <Chip
              key={genre}
              label={genre}
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.1)",
                color: "text.secondary",
                height: 22,
                fontSize: "0.7rem",
              }}
            />
          ))}
        </Box>

        {/* Synopsis */}
        {synopsis && (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              mb: 3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {synopsis}
          </Typography>
        )}

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<Play size={18} />}
            onClick={onPlay}
            size="large"
          >
            {t("hero.play")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Plus size={18} />}
            onClick={onAddToList}
            size="large"
            sx={{
              borderColor: "rgba(255,255,255,0.3)",
              color: "text.primary",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.5)",
                bgcolor: "rgba(255,255,255,0.05)",
              },
            }}
          >
            {t("hero.myList")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
