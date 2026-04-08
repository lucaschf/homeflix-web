import { useMemo } from "react";
import {
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMovies, useSeries } from "../api/hooks";
import { HeroBanner, type HeroSlide } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";

interface BrowseItem {
  id: string;
  title: string;
  year: number;
  type: "movie" | "series";
  genres: string[];
  posterUrl?: string;
}

interface GenreSection {
  genre: string;
  items: BrowseItem[];
}

export function Browse() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: moviesData, isLoading: moviesLoading } = useMovies();
  const { data: seriesData, isLoading: seriesLoading } = useSeries();

  const typeFilter = searchParams.get("type") as "movie" | "series" | null;
  const genreFilter = searchParams.get("genre");

  const allItems: BrowseItem[] = useMemo(() => {
    const movies = (moviesData?.movies ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      year: m.year,
      type: "movie" as const,
      genres: m.genres,
      posterUrl: m.poster_path ?? undefined,
    }));
    const series = (seriesData?.series ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      year: s.start_year,
      type: "series" as const,
      genres: s.genres,
      posterUrl: s.poster_path ?? undefined,
    }));
    return [...movies, ...series];
  }, [moviesData, seriesData]);

  const filtered = useMemo(() => {
    if (!typeFilter) return allItems;
    return allItems.filter((item) => item.type === typeFilter);
  }, [allItems, typeFilter]);

  const genreSections: GenreSection[] = useMemo(() => {
    const genreMap = new Map<string, BrowseItem[]>();
    for (const item of filtered) {
      for (const g of item.genres) {
        if (!genreMap.has(g)) genreMap.set(g, []);
        genreMap.get(g)!.push(item);
      }
    }
    return [...genreMap.entries()]
      .map(([genre, items]) => ({ genre, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [filtered]);

  const heroSlides: HeroSlide[] = useMemo(() => {
    const movieSlides: HeroSlide[] = (moviesData?.movies ?? [])
      .filter((m) => m.backdrop_path)
      .map((m) => ({
        id: m.id,
        type: "movie" as const,
        title: m.title,
        synopsis: m.synopsis,
        year: m.year,
        duration: m.duration_formatted,
        genres: m.genres,
        backdropUrl: m.backdrop_path,
      }));

    const seriesSlides: HeroSlide[] = (seriesData?.series ?? [])
      .filter((s) => s.backdrop_path)
      .map((s) => ({
        id: s.id,
        type: "series" as const,
        title: s.title,
        synopsis: s.synopsis,
        year: s.start_year,
        genres: s.genres,
        backdropUrl: s.backdrop_path,
      }));

    if (typeFilter === "movie") return movieSlides.slice(0, 6);
    if (typeFilter === "series") return seriesSlides.slice(0, 6);
    return [...movieSlides, ...seriesSlides]
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      .slice(0, 6);
  }, [moviesData, seriesData, typeFilter]);

  const isLoading = moviesLoading || seriesLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {!genreFilter && heroSlides.length > 0 && (
        <HeroBanner
          slides={heroSlides}
          onPlay={(slide) => {
            if (slide.type === "movie") navigate(`/movie/${slide.id}`);
            else navigate(`/series/${slide.id}`);
          }}
        />
      )}

      <Box sx={{ mt: Boolean(genreFilter) || heroSlides.length === 0 ? 4 : -10, position: "relative", zIndex: 1 }}>
      {genreFilter ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: { xs: 3, md: 6 }, mb: 3 }}>
            <Typography variant="h2">{genreFilter}</Typography>
            <Typography
              variant="body2"
              onClick={() => {
                searchParams.delete("genre");
                setSearchParams(searchParams);
              }}
              sx={{ color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
            >
              {t("browse.all")} &gt;
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(3, 1fr)",
                sm: "repeat(4, 1fr)",
                md: "repeat(5, 1fr)",
                lg: "repeat(6, 1fr)",
                xl: "repeat(7, 1fr)",
              },
              gap: { xs: 1, sm: 1.5, md: 2 },
              px: { xs: 2, md: 6 },
            }}
          >
            {filtered
              .filter((item) => item.genres.includes(genreFilter))
              .map((item) => (
                <MediaCard
                  key={item.id}
                  title={item.title}
                  year={item.year}
                  posterUrl={item.posterUrl}
                  variant="poster"
                  fullWidth
                  onClick={() => navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)}
                />
              ))}
          </Box>
        </>
      ) : genreSections.length > 0 ? (
        genreSections.map((section) => (
          <MediaCarousel
            key={section.genre}
            title={section.genre}
            onSeeAll={() => {
              searchParams.set("genre", section.genre);
              setSearchParams(searchParams);
            }}
          >
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
        ))
      ) : (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="body1" color="text.secondary">
            {t("browse.noResults")}
          </Typography>
        </Box>
      )}
      </Box>
    </Box>
  );
}
