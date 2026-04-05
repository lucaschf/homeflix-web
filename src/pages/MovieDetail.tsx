import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Typography,
} from "@mui/material";
import { Heart, Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

// TODO: Replace with real API data via TanStack Query + useParams
const MOCK_MOVIE = {
  id: "mov_abc123",
  title: "Inception",
  originalTitle: "Inception",
  year: 2010,
  duration: "2h 28min",
  synopsis:
    "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O., but his tragic past may doom the project and his team to disaster.",
  genres: ["Sci-Fi", "Action", "Thriller"],
  backdropUrl:
    "https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
  posterUrl:
    "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
  audio: ["English 5.1", "Portuguese 2.0"],
  subtitles: ["Portuguese", "English"],
};

export function MovieDetail() {
  const { t } = useTranslation();
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const movie = MOCK_MOVIE;

  return (
    <Box>
      {/* Hero Header */}
      <Box sx={{ position: "relative", width: "100%", height: { xs: 450, md: 550 }, overflow: "hidden" }}>
        {movie.backdropUrl && (
          <Box
            component="img"
            src={movie.backdropUrl}
            alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.7) 35%, transparent 65%)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.4) 25%, transparent 50%)",
          }}
        />

        {/* Content */}
        <Box
          sx={{
            position: "relative",
            height: "100%",
            display: "flex",
            alignItems: "flex-end",
            px: { xs: 3, md: 6 },
            pb: { xs: 4, md: 6 },
            gap: 4,
          }}
        >
          {/* Poster */}
          <Box
            component="img"
            src={movie.posterUrl}
            alt={movie.title}
            sx={{
              width: { xs: 140, md: 200 },
              aspectRatio: "2/3",
              borderRadius: 2,
              objectFit: "cover",
              display: { xs: "none", sm: "block" },
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            }}
          />

          {/* Info */}
          <Box sx={{ flex: 1, maxWidth: 600 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.5rem" }, fontWeight: 700, mb: 1 }}>
              {movie.title}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">{movie.year}</Typography>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary">{movie.duration}</Typography>
              {movie.genres.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 22, fontSize: "0.7rem" }}
                />
              ))}
            </Box>

            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button variant="contained" startIcon={<Play size={18} />} size="large">
                {t("detail.watchNow")}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Plus size={18} />}
                size="large"
                sx={{
                  borderColor: "rgba(255,255,255,0.3)",
                  color: "text.primary",
                  "&:hover": { borderColor: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.05)" },
                }}
              >
                {t("detail.addToList")}
              </Button>
              <IconButton sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}>
                <Heart size={22} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ px: { xs: 3, md: 6 }, py: 4, maxWidth: 1000 }}>
        {/* Synopsis */}
        <Typography variant="h2" sx={{ mb: 1.5 }}>{t("detail.synopsis")}</Typography>
        <Collapse in={synopsisExpanded} collapsedSize={60}>
          <Typography variant="body1" color="text.secondary">
            {movie.synopsis}
          </Typography>
        </Collapse>
        {movie.synopsis.length > 150 && (
          <Typography
            variant="body2"
            onClick={() => setSynopsisExpanded(!synopsisExpanded)}
            sx={{ color: "primary.main", cursor: "pointer", mt: 0.5, "&:hover": { textDecoration: "underline" } }}
          >
            {synopsisExpanded ? t("detail.showLess") : t("detail.showMore")}
          </Typography>
        )}

        {/* Details */}
        <Typography variant="h2" sx={{ mt: 4, mb: 1.5 }}>{t("detail.details")}</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {movie.originalTitle && movie.originalTitle !== movie.title && (
            <DetailRow label={t("detail.originalTitle")} value={movie.originalTitle} />
          )}
          <DetailRow label={t("detail.audio")} value={movie.audio.join(", ")} />
          <DetailRow label={t("detail.subtitles")} value={movie.subtitles.join(", ")} />
        </Box>
      </Box>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}:
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}
