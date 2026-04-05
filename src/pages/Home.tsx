import { Box, Button, Typography } from "@mui/material";
import { Film, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";

// TODO: Replace with real API data via TanStack Query
const MOCK_HERO = {
  title: "Inception",
  synopsis:
    "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
  year: 2010,
  duration: "2h 28min",
  genres: ["Sci-Fi", "Action", "Thriller"],
  backdropUrl: "https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
};

const MOCK_MOVIES = [
  { title: "Interstellar", year: 2014 },
  { title: "The Dark Knight", year: 2008 },
  { title: "Pulp Fiction", year: 1994 },
  { title: "Fight Club", year: 1999 },
  { title: "The Matrix", year: 1999 },
  { title: "Parasite", year: 2019 },
  { title: "Whiplash", year: 2014 },
];

const MOCK_CONTINUE = [
  { title: "Breaking Bad", subtitle: "S02E05 - Breakage", progress: 45 },
  { title: "Inception", subtitle: "1h 12min left", progress: 65 },
  { title: "The Office", subtitle: "S04E01 - Fun Run", progress: 20 },
];

const MOCK_SERIES = [
  { title: "Breaking Bad", year: 2008 },
  { title: "The Office", year: 2005 },
  { title: "Stranger Things", year: 2016 },
  { title: "Dark", year: 2017 },
  { title: "Better Call Saul", year: 2015 },
  { title: "Chernobyl", year: 2019 },
];

export function Home() {
  const { t } = useTranslation();
  const hasContent = true; // TODO: check if library has content

  if (!hasContent) {
    return <EmptyState />;
  }

  return (
    <Box>
      <HeroBanner {...MOCK_HERO} />

      <Box sx={{ mt: -4, position: "relative", zIndex: 1 }}>
        <MediaCarousel title={t("home.continueWatching")}>
          {MOCK_CONTINUE.map((item) => (
            <MediaCard
              key={item.title}
              title={item.title}
              subtitle={item.subtitle}
              progress={item.progress}
              variant="episode"
            />
          ))}
        </MediaCarousel>

        <MediaCarousel title={t("home.recentlyAdded")} onSeeAll={() => {}}>
          {MOCK_MOVIES.map((item) => (
            <MediaCard
              key={item.title}
              title={item.title}
              year={item.year}
              variant="poster"
            />
          ))}
        </MediaCarousel>

        <MediaCarousel title={t("home.movies")} onSeeAll={() => {}}>
          {MOCK_MOVIES.map((item) => (
            <MediaCard
              key={item.title}
              title={item.title}
              year={item.year}
              variant="poster"
            />
          ))}
        </MediaCarousel>

        <MediaCarousel title={t("home.series")} onSeeAll={() => {}}>
          {MOCK_SERIES.map((item) => (
            <MediaCard
              key={item.title}
              title={item.title}
              year={item.year}
              variant="poster"
            />
          ))}
        </MediaCarousel>
      </Box>
    </Box>
  );
}

function EmptyState() {
  const { t } = useTranslation();

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
      <Button variant="contained" startIcon={<FolderOpen size={20} />} size="large">
        {t("empty.addLibrary")}
      </Button>
    </Box>
  );
}
