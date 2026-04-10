import { useMemo } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Film, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useContinueWatching, useFeatured, useMovies, useSeries } from "../api/hooks";
import type { MovieSummary, SeriesSummary } from "../api/types";
import { HeroBanner, type HeroSlide } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";

interface GenreSection {
  genre: string;
  items: Array<{ id: string; title: string; year: number; type: "movie" | "series"; imageUrl?: string; synopsis?: string }>;
}

function buildGenreSections(movies: MovieSummary[], series: SeriesSummary[]): GenreSection[] {
  const genreMap = new Map<string, GenreSection["items"]>();

  for (const m of movies) {
    for (const g of m.genres) {
      if (!genreMap.has(g)) genreMap.set(g, []);
      genreMap.get(g)!.push({ id: m.id, title: m.title, year: m.year, type: "movie", imageUrl: m.poster_path ?? undefined, synopsis: m.synopsis ?? undefined });
    }
  }

  for (const s of series) {
    for (const g of s.genres) {
      if (!genreMap.has(g)) genreMap.set(g, []);
      genreMap.get(g)!.push({ id: s.id, title: s.title, year: s.start_year, type: "series", imageUrl: s.poster_path ?? undefined, synopsis: s.synopsis ?? undefined });
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
  const { data: featured } = useFeatured("all");

  const movies = moviesData?.movies ?? [];
  const series = seriesData?.series ?? [];
  const isLoading = moviesLoading || seriesLoading;
  const hasContent = movies.length > 0 || series.length > 0;

  const genreSections = useMemo(() => buildGenreSections(movies, series), [movies, series]);

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

        {movies.length > 0 && (
          <MediaCarousel title={t("home.movies")} onSeeAll={() => navigate("/browse?type=movie")}>
            {movies.map((movie) => (
              <MediaCard
                key={movie.id}
                title={movie.title}
                year={movie.year}
                imageUrl={movie.poster_path ?? undefined}
                synopsis={movie.synopsis ?? undefined}
                variant="poster"
                mediaId={movie.id}
                mediaType="movie"
                onPlay={() => navigate(`/play/movie/${movie.id}`)}
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
                imageUrl={s.poster_path ?? undefined}
                synopsis={s.synopsis ?? undefined}
                variant="poster"
                mediaId={s.id}
                mediaType="series"
                onPlay={() => navigate(`/series/${s.id}`)}
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
                imageUrl={item.imageUrl}
                synopsis={item.synopsis}
                variant="poster"
                mediaId={item.id}
                mediaType={item.type}
                onPlay={() => navigate(item.type === "movie" ? `/play/movie/${item.id}` : `/series/${item.id}`)}
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
