import { useMemo } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Film, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useContinueWatching, useFeatured, useGenres } from "../api/hooks";
import { LazyGenreCarousel } from "../components/GenreCarousel";
import { HeroBanner, type HeroSlide } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";
import { peach } from "../theme/colors";

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: genres, isLoading: genresLoading } = useGenres();
  const { data: continueWatching } = useContinueWatching();
  const { data: featured } = useFeatured("all");

  const isLoading = genresLoading;
  const hasContent = (genres?.length ?? 0) > 0;

  const heroSlides: HeroSlide[] = useMemo(
    () =>
      (featured ?? []).map((f) => ({
        id: f.id,
        type: f.type,
        title: f.title,
        synopsis: f.synopsis,
        year: f.year,
        duration: f.duration_formatted ?? undefined,
        genres: f.genres,
        backdropUrl: f.backdrop_path,
        contentRating: f.content_rating,
        trailerUrl: f.trailer_url,
      })),
    [featured],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!hasContent) {
    return <EmptyState />;
  }

  return (
    <Box>
      {heroSlides.length > 0 && (
        <HeroBanner
          slides={heroSlides}
          onPlay={(slide) => {
            if (slide.type === "movie") navigate(`/play/movie/${slide.id}`);
            else navigate(`/series/${slide.id}`);
          }}
          onDetails={(slide) => {
            if (slide.type === "movie") navigate(`/movie/${slide.id}`);
            else navigate(`/series/${slide.id}`);
          }}
        />
      )}

      <Box sx={{ mt: -10, position: "relative", zIndex: 1 }}>
        {continueWatching && continueWatching.length > 0 && (
          <MediaCarousel title={t("home.continueWatching")}>
            {continueWatching.map((item) => (
              <MediaCard
                key={item.media_id}
                title={
                  item.media_type === "episode" &&
                  item.series_title &&
                  item.season_number != null &&
                  item.episode_number != null
                    ? `${item.series_title} - S${String(item.season_number).padStart(2, "0")}E${String(item.episode_number).padStart(2, "0")}`
                    : item.title
                }
                imageUrl={item.backdrop_path ?? item.poster_path ?? undefined}
                progress={item.percentage}
                variant="landscape"
                onClick={() => {
                  if (item.media_type === "movie") {
                    navigate(`/play/movie/${item.media_id}`);
                  } else if (
                    item.media_type === "episode" &&
                    item.series_id &&
                    item.season_number != null &&
                    item.episode_number != null
                  ) {
                    navigate(`/play/episode/${item.series_id}/${item.season_number}/${item.episode_number}`);
                  }
                }}
              />
            ))}
          </MediaCarousel>
        )}

        {(genres ?? []).map((genre) => (
          <LazyGenreCarousel key={genre.id} genre={genre} />
        ))}
      </Box>
    </Box>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 3,
          bgcolor: "primary.alpha12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
        }}
      >
        <Film size={32} color={peach.main} />
      </Box>
      <Typography variant="h1" gutterBottom>
        {t("empty.welcome")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>
        {t("empty.description")}
      </Typography>
      <Button
        variant="contained"
        startIcon={<FolderOpen size={20} />}
        size="large"
        onClick={() => navigate("/settings")}
      >
        {t("empty.addLibrary")}
      </Button>
    </Box>
  );
}
