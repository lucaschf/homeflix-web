import { useMemo } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Film, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useContinueWatching, useMovies, useSeries } from "../api/hooks";
import type { MovieSummary, SeriesSummary } from "../api/types";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";

interface GenreSection {
  genre: string;
  items: Array<{ id: string; title: string; year: number; type: "movie" | "series"; posterUrl?: string }>;
}

function buildGenreSections(movies: MovieSummary[], series: SeriesSummary[]): GenreSection[] {
  const genreMap = new Map<string, GenreSection["items"]>();

  for (const m of movies) {
    for (const g of m.genres) {
      if (!genreMap.has(g)) genreMap.set(g, []);
      genreMap.get(g)!.push({ id: m.id, title: m.title, year: m.year, type: "movie", posterUrl: m.poster_path ?? undefined });
    }
  }

  for (const s of series) {
    for (const g of s.genres) {
      if (!genreMap.has(g)) genreMap.set(g, []);
      genreMap.get(g)!.push({ id: s.id, title: s.title, year: s.start_year, type: "series", posterUrl: s.poster_path ?? undefined });
    }
  }

  return [...genreMap.entries()]
    .map(([genre, items]) => ({ genre, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: moviesData, isLoading: moviesLoading } = useMovies();
  const { data: seriesData, isLoading: seriesLoading } = useSeries();
  const { data: continueWatching } = useContinueWatching();

  const movies = moviesData?.movies ?? [];
  const series = seriesData?.series ?? [];
  const isLoading = moviesLoading || seriesLoading;
  const hasContent = movies.length > 0 || series.length > 0;

  const genreSections = useMemo(() => buildGenreSections(movies, series), [movies, series]);

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
        {continueWatching && continueWatching.length > 0 && (
          <MediaCarousel title={t("home.continueWatching")}>
            {continueWatching.map((item) => (
              <MediaCard
                key={item.media_id}
                title={item.title}
                posterUrl={item.poster_path ?? undefined}
                progress={item.percentage}
                variant="poster"
                onClick={() => {
                  if (item.media_type === "movie") {
                    navigate(`/play/movie/${item.media_id}`);
                  }
                }}
              />
            ))}
          </MediaCarousel>
        )}

        {movies.length > 0 && (
          <MediaCarousel title={t("home.movies")} onSeeAll={() => navigate("/browse?type=movie")}>
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
          <MediaCarousel title={t("home.series")} onSeeAll={() => navigate("/browse?type=series")}>
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

        {genreSections.map((section) => (
          <MediaCarousel key={section.genre} title={section.genre} onSeeAll={() => navigate(`/browse?genre=${encodeURIComponent(section.genre)}`)}>
            {section.items.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title}
                year={item.year}
                posterUrl={item.posterUrl}
                variant="poster"
                onClick={() => navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)}
              />
            ))}
          </MediaCarousel>
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
