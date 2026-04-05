import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { Heart, Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

// TODO: Replace with real API data via TanStack Query + useParams
const MOCK_SERIES = {
  id: "ser_abc123",
  title: "Breaking Bad",
  originalTitle: "Breaking Bad",
  startYear: 2008,
  endYear: 2013,
  synopsis:
    "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student in order to secure his family's future.",
  genres: ["Drama", "Crime", "Thriller"],
  backdropUrl:
    "https://image.tmdb.org/t/p/original/gc8PfyTqzqltKMPhILMJwwBSPGW.jpg",
  posterUrl:
    "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW73GM3cQydO.jpg",
  seasons: [
    {
      number: 1,
      episodes: [
        { number: 1, title: "Pilot", duration: "58 min", airDate: "Jan 20, 2008", synopsis: "Walter White, a struggling high school chemistry teacher, is diagnosed with advanced lung cancer.", progress: 45 },
        { number: 2, title: "Cat's in the Bag...", duration: "48 min", airDate: "Jan 27, 2008", synopsis: "Walt and Jesse attempt to tie up loose ends.", progress: 0 },
        { number: 3, title: "...And the Bag's in the River", duration: "48 min", airDate: "Feb 10, 2008", synopsis: "Walt is faced with a difficult decision.", progress: 0 },
        { number: 4, title: "Cancer Man", duration: "48 min", airDate: "Feb 17, 2008", synopsis: "Walt tells the family about his diagnosis.", progress: 0 },
        { number: 5, title: "Gray Matter", duration: "48 min", airDate: "Feb 24, 2008", synopsis: "Walt and Skyler attend a party at their former friends'.", progress: 0 },
        { number: 6, title: "Crazy Handful of Nothin'", duration: "47 min", airDate: "Mar 2, 2008", synopsis: "Walt begins to feel the effects of chemotherapy.", progress: 0 },
        { number: 7, title: "A No-Rough-Stuff-Type Deal", duration: "47 min", airDate: "Mar 9, 2008", synopsis: "Walt and Jesse try to up their game.", progress: 0 },
      ],
    },
    {
      number: 2,
      episodes: [
        { number: 1, title: "Seven Thirty-Seven", duration: "47 min", airDate: "Mar 8, 2009", synopsis: "Walt and Jesse face the consequences.", progress: 0 },
        { number: 2, title: "Grilled", duration: "48 min", airDate: "Mar 15, 2009", synopsis: "Walt and Jesse find themselves in a dire situation.", progress: 0 },
        { number: 3, title: "Bit by a Dead Bee", duration: "47 min", airDate: "Mar 22, 2009", synopsis: "Walt and Jesse deal with the aftermath.", progress: 0 },
      ],
    },
  ],
};

export function SeriesDetail() {
  const { t } = useTranslation();
  const [selectedSeason, setSelectedSeason] = useState(0);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const series = MOCK_SERIES;
  const currentSeason = series.seasons[selectedSeason];

  return (
    <Box>
      {/* Hero Header */}
      <Box sx={{ position: "relative", width: "100%", height: { xs: 450, md: 550 }, overflow: "hidden" }}>
        {series.backdropUrl && (
          <Box
            component="img"
            src={series.backdropUrl}
            alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.7) 35%, transparent 65%)" }} />
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.4) 25%, transparent 50%)" }} />

        <Box sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", px: { xs: 3, md: 6 }, pb: { xs: 4, md: 6 }, gap: 4 }}>
          <Box
            component="img"
            src={series.posterUrl}
            alt={series.title}
            sx={{
              width: { xs: 140, md: 200 },
              aspectRatio: "2/3",
              borderRadius: 2,
              objectFit: "cover",
              display: { xs: "none", sm: "block" },
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            }}
          />

          <Box sx={{ flex: 1, maxWidth: 600 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.5rem" }, fontWeight: 700, mb: 1 }}>
              {series.title}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {series.startYear}{series.endYear ? `–${series.endYear}` : "–"}
              </Typography>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("common.seasons", { count: series.seasons.length })}
              </Typography>
              {series.genres.map((g) => (
                <Chip key={g} label={g} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 22, fontSize: "0.7rem" }} />
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
                sx={{ borderColor: "rgba(255,255,255,0.3)", color: "text.primary", "&:hover": { borderColor: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.05)" } }}
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
      <Box sx={{ px: { xs: 3, md: 6 }, py: 4 }}>
        {/* Synopsis */}
        <Collapse in={synopsisExpanded} collapsedSize={44}>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 800 }}>
            {series.synopsis}
          </Typography>
        </Collapse>
        {series.synopsis.length > 150 && (
          <Typography
            variant="body2"
            onClick={() => setSynopsisExpanded(!synopsisExpanded)}
            sx={{ color: "primary.main", cursor: "pointer", mt: 0.5, "&:hover": { textDecoration: "underline" } }}
          >
            {synopsisExpanded ? t("detail.showLess") : t("detail.showMore")}
          </Typography>
        )}

        {/* Season Tabs */}
        <Tabs
          value={selectedSeason}
          onChange={(_, v) => setSelectedSeason(v)}
          sx={{
            mt: 4,
            mb: 3,
            "& .MuiTab-root": { color: "text.secondary", textTransform: "none", fontWeight: 500 },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": { bgcolor: "primary.main" },
          }}
        >
          {series.seasons.map((s, idx) => (
            <Tab
              key={s.number}
              value={idx}
              label={s.number === 0 ? t("detail.specials") : t("detail.season", { number: s.number })}
            />
          ))}
        </Tabs>

        {/* Episode List */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {currentSeason.episodes.map((ep) => (
            <EpisodeRow key={ep.number} episode={ep} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

interface EpisodeData {
  number: number;
  title: string;
  duration: string;
  airDate: string;
  synopsis: string;
  progress: number;
  thumbnailUrl?: string;
}

function EpisodeRow({ episode }: { episode: EpisodeData }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        p: 1.5,
        borderRadius: 2,
        cursor: "pointer",
        "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
        "&:hover .ep-play": { opacity: 1 },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ position: "relative", width: { xs: 140, md: 200 }, flexShrink: 0, aspectRatio: "16/9", borderRadius: 1.5, overflow: "hidden", bgcolor: "background.paper" }}>
        {episode.thumbnailUrl ? (
          <Box component="img" src={episode.thumbnailUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Box sx={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)" }} />
        )}

        {/* Play overlay */}
        <Box
          className="ep-play"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.4)",
            opacity: 0,
            transition: "opacity 200ms",
          }}
        >
          <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={20} color="#0D0D0D" fill="#0D0D0D" />
          </Box>
        </Box>

        {/* Progress bar */}
        {episode.progress > 0 && (
          <LinearProgress
            variant="determinate"
            value={episode.progress}
            sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, bgcolor: "rgba(255,255,255,0.2)", "& .MuiLinearProgress-bar": { bgcolor: "primary.main" } }}
          />
        )}
      </Box>

      {/* Info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
          <Typography variant="body1" fontWeight={600}>
            {t("detail.episode", { number: episode.number })}
          </Typography>
          <Typography variant="body1" fontWeight={500} noWrap>
            {episode.title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {episode.duration} | {episode.airDate}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: { xs: "none", md: "-webkit-box" },
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {episode.synopsis}
        </Typography>
      </Box>
    </Box>
  );
}
