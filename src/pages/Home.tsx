import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Film, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMovies, useSeries } from "../api/hooks";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: moviesData, isLoading: moviesLoading } = useMovies();
  const { data: seriesData, isLoading: seriesLoading } = useSeries();

  const movies = moviesData?.movies ?? [];
  const series = seriesData?.series ?? [];
  const isLoading = moviesLoading || seriesLoading;
  const hasContent = movies.length > 0 || series.length > 0;

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

  // Pick a random movie for hero banner
  const heroMovie = movies[0];

  return (
    <Box>
      {heroMovie && (
        <HeroBanner
          title={heroMovie.title}
          year={heroMovie.year}
          duration={heroMovie.duration_formatted}
          genres={heroMovie.genres}
          posterUrl={heroMovie.poster_path ?? undefined}
          onPlay={() => navigate(`/movie/${heroMovie.id}`)}
        />
      )}

      <Box sx={{ mt: -4, position: "relative", zIndex: 1 }}>
        {movies.length > 0 && (
          <MediaCarousel title={t("home.movies")} onSeeAll={() => navigate("/browse")}>
            {movies.map((movie) => (
              <MediaCard
                key={movie.id}
                title={movie.title}
                year={movie.year}
                posterUrl={movie.poster_path ?? undefined}
                variant="poster"
                onClick={() => navigate(`/movie/${movie.id}`)}
              />
            ))}
          </MediaCarousel>
        )}

        {series.length > 0 && (
          <MediaCarousel title={t("home.series")} onSeeAll={() => navigate("/browse")}>
            {series.map((s) => (
              <MediaCard
                key={s.id}
                title={s.title}
                year={s.start_year}
                posterUrl={s.poster_path ?? undefined}
                variant="poster"
                onClick={() => navigate(`/series/${s.id}`)}
              />
            ))}
          </MediaCarousel>
        )}
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
        <Film size={32} color="#E8926F" />
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
