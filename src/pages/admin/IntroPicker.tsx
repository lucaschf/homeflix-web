import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Pencil, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useListAllSeries, useSeriesDetail } from "../../api/hooks";
import type { EpisodeOutput, SeasonOutput, SeriesDetail } from "../../api/types";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type IntroFilter = "all" | "unmarked" | "low_confidence" | "manual";

// Confidence threshold below which an auto marker is considered
// shaky enough to surface in the "low confidence" triage filter.
// Picked from a quick eyeball of recent detections — anything under
// 0.7 in our current pipeline tends to land on the wrong frame.
const LOW_CONFIDENCE_THRESHOLD = 0.7;

function matchesFilter(intro: EpisodeOutput["intro"], filter: IntroFilter): boolean {
  switch (filter) {
    case "unmarked":
      return intro === null;
    case "manual":
      return intro?.source === "MANUAL";
    case "low_confidence":
      return (
        intro?.source === "AUTO_DETECTED" &&
        intro.confidence !== null &&
        intro.confidence < LOW_CONFIDENCE_THRESHOLD
      );
    case "all":
    default:
      return true;
  }
}

export function IntroPicker() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.intros.title"));
  const [search, setSearch] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [filter, setFilter] = useState<IntroFilter>("all");

  const { items: allSeries, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useListAllSeries();

  const filteredSeries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSeries;
    return allSeries.filter((s) => s.title.toLowerCase().includes(q));
  }, [allSeries, search]);

  const { data: seriesDetail } = useSeriesDetail(selectedSeriesId ?? "");

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={1} mb={3}>
        <Typography variant="h2">{t("admin.intros.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("admin.intros.subtitle")}
        </Typography>
      </Stack>

      <Box sx={{ display: "flex", gap: 2, alignItems: "stretch" }}>
        <Paper
          variant="outlined"
          sx={{
            width: 340,
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 220px)",
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t("admin.intros.searchSeries")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box sx={{ overflowY: "auto", flex: 1 }}>
            {isLoading ? (
              <Box p={2}>
                <Typography variant="body2" color="text.secondary">
                  {t("admin.intros.loading")}
                </Typography>
              </Box>
            ) : filteredSeries.length === 0 ? (
              <Box p={2}>
                <Typography variant="body2" color="text.secondary">
                  {search ? t("admin.intros.noResults") : t("admin.intros.noSeries")}
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {filteredSeries.map((s) => (
                  <ListItemButton
                    key={s.id}
                    selected={s.id === selectedSeriesId}
                    onClick={() => setSelectedSeriesId(s.id)}
                  >
                    <ListItemText
                      primary={s.title}
                      secondary={t("common.episodes", { count: s.total_episodes })}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
            {hasNextPage && (
              <Box p={1.5}>
                <Button
                  fullWidth
                  size="small"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {t("browse.loadMore")}
                </Button>
              </Box>
            )}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ flex: 1, p: 3, maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
          {seriesDetail ? (
            <SeriesEpisodes
              detail={seriesDetail}
              filter={filter}
              onFilterChange={setFilter}
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t("admin.intros.selectSeriesHint")}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

interface SeriesEpisodesProps {
  detail: SeriesDetail;
  filter: IntroFilter;
  onFilterChange: (next: IntroFilter) => void;
}

function SeriesEpisodes({ detail, filter, onFilterChange }: SeriesEpisodesProps) {
  const { t } = useTranslation();
  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
        <Typography variant="h3">{detail.title}</Typography>
        <TextField
          select
          size="small"
          label={t("admin.intros.filter")}
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as IntroFilter)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">{t("admin.intros.filterAll")}</MenuItem>
          <MenuItem value="unmarked">{t("admin.intros.filterUnmarked")}</MenuItem>
          <MenuItem value="low_confidence">{t("admin.intros.filterLowConfidence")}</MenuItem>
          <MenuItem value="manual">{t("admin.intros.filterManual")}</MenuItem>
        </TextField>
      </Stack>

      {detail.seasons.map((season) => {
        const visible = season.episodes.filter((e) => matchesFilter(e.intro, filter));
        if (visible.length === 0) return null;
        return (
          <SeasonBlock
            key={season.season_number}
            seriesId={detail.id}
            season={season}
            visibleEpisodes={visible}
          />
        );
      })}
    </Stack>
  );
}

interface SeasonBlockProps {
  seriesId: string;
  season: SeasonOutput;
  visibleEpisodes: EpisodeOutput[];
}

function SeasonBlock({ seriesId, season, visibleEpisodes }: SeasonBlockProps) {
  const { t } = useTranslation();
  const heading =
    season.season_number === 0
      ? t("admin.intros.specials")
      : t("admin.intros.season", { number: season.season_number });
  return (
    <Stack spacing={1}>
      <Typography variant="h4" color="text.secondary">
        {heading}
      </Typography>
      <Stack spacing={0.5}>
        {visibleEpisodes.map((ep) => (
          <EpisodeRow
            key={`${season.season_number}-${ep.episode_number}`}
            seriesId={seriesId}
            seasonNumber={season.season_number}
            episode={ep}
          />
        ))}
      </Stack>
    </Stack>
  );
}

interface EpisodeRowProps {
  seriesId: string;
  seasonNumber: number;
  episode: EpisodeOutput;
}

function EpisodeRow({ seriesId, seasonNumber, episode }: EpisodeRowProps) {
  const { t } = useTranslation();
  const intro = episode.intro;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography variant="body2" sx={{ width: 56, color: "text.secondary" }}>
        {t("detail.episode", { number: episode.episode_number })}
      </Typography>
      <Typography variant="body1" sx={{ flex: 1 }} noWrap>
        {episode.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ width: 64, textAlign: "right" }}>
        {episode.duration_formatted}
      </Typography>
      <IntroBadge intro={intro} />
      <IconButton
        component={RouterLink}
        to={`/admin/intros/${seriesId}/${seasonNumber}/${episode.episode_number}`}
        size="small"
        aria-label={t("admin.intros.edit")}
        disabled={!episode.file_path}
      >
        <Pencil size={16} />
      </IconButton>
    </Box>
  );
}

function IntroBadge({ intro }: { intro: EpisodeOutput["intro"] }) {
  const { t } = useTranslation();
  if (!intro) {
    return <Chip label={t("admin.intros.statusNone")} size="small" variant="outlined" />;
  }
  if (intro.source === "MANUAL") {
    return <Chip label={t("admin.intros.statusManual")} size="small" color="success" />;
  }
  const confidencePct = Math.round((intro.confidence ?? 0) * 100);
  const isLow = (intro.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD;
  return (
    <Chip
      label={t("admin.intros.statusAuto", { confidence: confidencePct })}
      size="small"
      color={isLow ? "warning" : "default"}
      variant={isLow ? "filled" : "outlined"}
    />
  );
}
