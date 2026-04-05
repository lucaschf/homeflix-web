import { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { MediaCard } from "../components/MediaCard";

// TODO: Replace with real API data via TanStack Query
const MOCK_ITEMS = [
  { id: "mov_1", title: "Inception", year: 2010, type: "movie", genres: ["Sci-Fi", "Action"] },
  { id: "mov_2", title: "Interstellar", year: 2014, type: "movie", genres: ["Sci-Fi", "Drama"] },
  { id: "mov_3", title: "The Dark Knight", year: 2008, type: "movie", genres: ["Action", "Crime"] },
  { id: "mov_4", title: "Pulp Fiction", year: 1994, type: "movie", genres: ["Crime", "Drama"] },
  { id: "mov_5", title: "Fight Club", year: 1999, type: "movie", genres: ["Drama", "Thriller"] },
  { id: "mov_6", title: "The Matrix", year: 1999, type: "movie", genres: ["Sci-Fi", "Action"] },
  { id: "mov_7", title: "Parasite", year: 2019, type: "movie", genres: ["Drama", "Thriller"] },
  { id: "mov_8", title: "Whiplash", year: 2014, type: "movie", genres: ["Drama", "Music"] },
  { id: "ser_1", title: "Breaking Bad", year: 2008, type: "series", genres: ["Drama", "Crime"] },
  { id: "ser_2", title: "The Office", year: 2005, type: "series", genres: ["Comedy"] },
  { id: "ser_3", title: "Stranger Things", year: 2016, type: "series", genres: ["Sci-Fi", "Horror"] },
  { id: "ser_4", title: "Dark", year: 2017, type: "series", genres: ["Sci-Fi", "Thriller"] },
  { id: "ser_5", title: "Better Call Saul", year: 2015, type: "series", genres: ["Drama", "Crime"] },
  { id: "ser_6", title: "Chernobyl", year: 2019, type: "series", genres: ["Drama", "History"] },
];

const ALL_GENRES = [...new Set(MOCK_ITEMS.flatMap((i) => i.genres))].sort();

type TypeFilter = "all" | "movie" | "series";
type SortOption = "recent" | "title_asc" | "title_desc" | "year_new" | "year_old";

export function Browse() {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState<SortOption>("recent");

  let filtered = MOCK_ITEMS.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (genre !== "all" && !item.genres.includes(genre)) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case "title_asc": return a.title.localeCompare(b.title);
      case "title_desc": return b.title.localeCompare(a.title);
      case "year_new": return b.year - a.year;
      case "year_old": return a.year - b.year;
      default: return 0;
    }
  });

  return (
    <Box sx={{ px: { xs: 3, md: 6 }, py: 4 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        {t("nav.browse")}
      </Typography>

      {/* Type Tabs */}
      <Tabs
        value={typeFilter}
        onChange={(_, v) => setTypeFilter(v)}
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

      {/* Filters Row */}
      <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t("browse.genre")}</InputLabel>
          <Select value={genre} onChange={(e) => setGenre(e.target.value)} label={t("browse.genre")}>
            <MenuItem value="all">{t("browse.allGenres")}</MenuItem>
            {ALL_GENRES.map((g) => (
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

      {/* Results Grid */}
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
              variant="poster"
              fullWidth
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

      {/* Load More */}
      {filtered.length > 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Button variant="outlined" sx={{ borderColor: "divider", color: "text.secondary" }}>
            {t("browse.loadMore")}
          </Button>
        </Box>
      )}
    </Box>
  );
}
