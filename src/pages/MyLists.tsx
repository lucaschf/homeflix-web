import { Box, CircularProgress, Typography } from "@mui/material";
import { Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useWatchlist } from "../api/hooks";
import { MediaCard } from "../components/MediaCard";

export function MyLists() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: items, isLoading } = useWatchlist();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 3, md: 5 }, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", md: "1.75rem" }, fontWeight: 700, mb: 4 }}>
        {t("lists.title")}
      </Typography>

      {items && items.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(3, 1fr)",
              sm: "repeat(4, 1fr)",
              md: "repeat(5, 1fr)",
              lg: "repeat(6, 1fr)",
            },
            gap: { xs: 1, sm: 1.5, md: 2 },
          }}
        >
          {items.map((item) => (
            <MediaCard
              key={item.media_id}
              title={item.title}
              posterUrl={item.poster_path ?? undefined}
              variant="poster"
              fullWidth
              onClick={() => {
                if (item.media_type === "movie") navigate(`/movie/${item.media_id}`);
                else navigate(`/series/${item.media_id}`);
              }}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Bookmark size={48} color="#555" />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            {t("lists.empty")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("lists.emptyHint")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
