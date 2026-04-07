import { useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMovies, useSeries } from "../api/hooks";
import { MediaCard } from "../components/MediaCard";

type TypeFilter = "all" | "movie" | "series";
type SortOption = "recent" | "title_asc" | "title_desc" | "year_new" | "year_old";

interface BrowseItem {
  id: string;
  title: string;
  year: number;
  type: "movie" | "series";
  genres: string[];
  posterUrl?: string;
}

export function Browse() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: moviesData, isLoading: moviesLoading } = useMovies();
  const { data: seriesData, isLoading: seriesLoading } = useSeries();

  const typeFilter = (searchParams.get("type") as TypeFilter) || "all";
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState<SortOption>("recent");

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

  const allGenres = useMemo(
    () => [...new Set(allItems.flatMap((i) => i.genres))].sort(),
    [allItems],
  );

  const filtered = useMemo(() => {
    let result = allItems.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (genre !== "all" && !item.genres.includes(genre)) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "title_asc": return a.title.localeCompare(b.title);
        case "title_desc": return b.title.localeCompare(a.title);
        case "year_new": return b.year - a.year;
        case "year_old": return a.year - b.year;
        default: return 0;
      }
    });

    return result;
  }, [allItems, typeFilter, genre, sort]);

  const isLoading = moviesLoading || seriesLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 3, md: 6 }, py: 4 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        {t("nav.browse")}
      </Typography>

      <Tabs
        value={typeFilter}
        onChange={(_, v) => {
          if (v === "all") {
            searchParams.delete("type");
          } else {
            searchParams.set("type", v);
          }
          setSearchParams(searchParams);
        }}
        sx={{
          mb: 3,
          "& .MuiTab-root": { color: "text.secondary", textTransform: "none", fontWeight: 500, minWidth: "auto", px: 2 },
          "& .Mui-selected": { color: "primary.main" },
          "& .MuiTabs-indicator": { bgcolor: "primary.main" },
        }}
      >
        <Tab value="all" label={t("browse.all")} />
        <Tab value="movie" label={t("home.movies")} />
        <Tab value="series" label={t("home.series")} />
      </Tabs>

      <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t("browse.genre")}</InputLabel>
          <Select value={genre} onChange={(e) => setGenre(e.target.value)} label={t("browse.genre")}>
            <MenuItem value="all">{t("browse.allGenres")}</MenuItem>
            {allGenres.map((g) => (
              <MenuItem key={g} value={g}>{g}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t("browse.sortBy")}</InputLabel>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} label={t("browse.sortBy")}>
            <MenuItem value="recent">{t("browse.recentlyAdded")}</MenuItem>
            <MenuItem value="title_asc">{t("browse.titleAZ")}</MenuItem>
            <MenuItem value="title_desc">{t("browse.titleZA")}</MenuItem>
            <MenuItem value="year_new">{t("browse.yearNewest")}</MenuItem>
            <MenuItem value="year_old">{t("browse.yearOldest")}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {filtered.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(4, 1fr)",
              lg: "repeat(5, 1fr)",
              xl: "repeat(6, 1fr)",
            },
            gap: 3,
          }}
        >
          {filtered.map((item) => (
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
      ) : (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="body1" color="text.secondary">
            {t("browse.noResults")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
