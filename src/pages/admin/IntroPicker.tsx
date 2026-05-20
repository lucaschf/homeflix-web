import { useEffect, useMemo, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { Pencil, Tv } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useListAllSeries, useSeriesDetail } from "../../api/hooks";
import type { EpisodeOutput, SeasonOutput, SeriesDetail } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminPageHeader,
  type BadgeTone,
  FilterChip,
  ToolbarSearch,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type IntroFilter = "all" | "unmarked" | "low_confidence" | "manual";

// Confidence threshold below which an auto marker is considered
// shaky enough to surface in the "low confidence" triage filter.
// Picked from a quick eyeball of recent detections — anything under
// 0.7 in our current pipeline tends to land on the wrong frame.
const LOW_CONFIDENCE_THRESHOLD = 0.7;
const SEARCH_DEBOUNCE_MS = 300;

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
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [filter, setFilter] = useState<IntroFilter>("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { items: allSeries, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useListAllSeries();

  const filteredSeries = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return allSeries;
    return allSeries.filter((s) => s.title.toLowerCase().includes(q));
  }, [allSeries, debouncedSearch]);

  const { data: seriesDetail } = useSeriesDetail(selectedSeriesId ?? "");

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.intros")]}
        title={t("admin.intros.title")}
        subtitle={t("admin.intros.subtitle")}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "340px 1fr" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <AdminCard sx={{ p: 0, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 240px)" }}>
          <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <ToolbarSearch
              value={searchInput}
              onChange={setSearchInput}
              placeholder={t("admin.intros.searchSeries")}
            />
          </Box>
          <Box sx={{ overflowY: "auto", flex: 1, py: 0.5 }}>
            {isLoading ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ p: 2 }}
              >
                {t("admin.intros.loading")}
              </Typography>
            ) : filteredSeries.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ p: 2 }}
              >
                {debouncedSearch
                  ? t("admin.intros.noResults")
                  : t("admin.intros.noSeries")}
              </Typography>
            ) : (
              <Stack spacing={0}>
                {filteredSeries.map((s) => {
                  const isActive = s.id === selectedSeriesId;
                  return (
                    <Box
                      key={s.id}
                      component="button"
                      type="button"
                      onClick={() => setSelectedSeriesId(s.id)}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 0.25,
                        py: 1.25,
                        px: 2,
                        bgcolor: isActive
                          ? "rgba(217,119,87,0.10)"
                          : "transparent",
                        borderLeft: "2px solid",
                        borderColor: isActive ? "primary.main" : "transparent",
                        color: isActive ? "primary.main" : "text.primary",
                        fontFamily: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background-color 120ms ease",
                        "&:hover": {
                          bgcolor: isActive
                            ? "rgba(217,119,87,0.14)"
                            : "rgba(255,255,255,0.04)",
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, color: "inherit" }}
                      >
                        {s.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "0.71875rem" }}
                      >
                        {t("common.episodes", { count: s.total_episodes })}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
            {hasNextPage && (
              <Box sx={{ p: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <AdminButton
                  variant="ghost"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {t("browse.loadMore")}
                </AdminButton>
              </Box>
            )}
          </Box>
        </AdminCard>

        <AdminCard
          sx={{
            maxHeight: "calc(100vh - 240px)",
            overflowY: "auto",
            ...(!seriesDetail && {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 360,
            }),
          }}
        >
          {seriesDetail ? (
            <SeriesEpisodes
              detail={seriesDetail}
              filter={filter}
              onFilterChange={setFilter}
            />
          ) : (
            <AdminEmptyState
              icon={Tv}
              title={t("admin.intros.selectSeriesHint")}
            />
          )}
        </AdminCard>
      </Box>
    </>
  );
}

interface SeriesEpisodesProps {
  detail: SeriesDetail;
  filter: IntroFilter;
  onFilterChange: (next: IntroFilter) => void;
}

function SeriesEpisodes({ detail, filter, onFilterChange }: SeriesEpisodesProps) {
  const { t } = useTranslation();
  const filterOptions: { label: string; value: IntroFilter }[] = [
    { label: t("admin.intros.filterAll"), value: "all" },
    { label: t("admin.intros.filterUnmarked"), value: "unmarked" },
    { label: t("admin.intros.filterLowConfidence"), value: "low_confidence" },
    { label: t("admin.intros.filterManual"), value: "manual" },
  ];

  const visibleSeasons = detail.seasons
    .map((season) => ({
      season,
      visible: season.episodes.filter((e) => matchesFilter(e.intro, filter)),
    }))
    .filter(({ visible }) => visible.length > 0);

  return (
    <>
      <AdminCardHeader
        title={detail.title}
        action={
          <FilterChip<IntroFilter>
            label={t("admin.intros.filter")}
            value={filter}
            options={filterOptions}
            onChange={onFilterChange}
          />
        }
      />

      {visibleSeasons.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          {t("admin.intros.noEpisodesForFilter")}
        </Typography>
      ) : (
        <Stack spacing={3}>
          {visibleSeasons.map(({ season, visible }) => (
            <SeasonBlock
              key={season.season_number}
              seriesId={detail.id}
              season={season}
              visibleEpisodes={visible}
            />
          ))}
        </Stack>
      )}
    </>
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
      <Typography
        variant="eyebrow"
        component="div"
        sx={{ color: "text.secondary" }}
      >
        {heading}
      </Typography>
      <Stack spacing={0.25}>
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
  const navigate = useNavigate();
  const intro = episode.intro;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.25,
        py: 1,
        borderRadius: 1,
        transition: "background-color 120ms ease",
        "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          width: 56,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          color: "text.secondary",
        }}
      >
        {t("detail.episode", { number: episode.episode_number })}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1, color: "text.primary" }} noWrap>
        {episode.title}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          width: 64,
          textAlign: "right",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}
      >
        {episode.duration_formatted}
      </Typography>
      <IntroBadge intro={intro} />
      <Tooltip title={t("admin.intros.edit")}>
        <span>
          <IconButton
            size="small"
            disabled={!episode.file_path}
            onClick={() =>
              navigate(
                `/admin/intros/${seriesId}/${seasonNumber}/${episode.episode_number}`,
              )
            }
            sx={{ color: "text.secondary" }}
          >
            <Pencil size={15} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

function IntroBadge({ intro }: { intro: EpisodeOutput["intro"] }) {
  const { t } = useTranslation();
  if (!intro) {
    return <AdminBadge tone="neutral">{t("admin.intros.statusNone")}</AdminBadge>;
  }
  if (intro.source === "MANUAL") {
    return <AdminBadge tone="ok">{t("admin.intros.statusManual")}</AdminBadge>;
  }
  const confidencePct = Math.round((intro.confidence ?? 0) * 100);
  const isLow = (intro.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD;
  const tone: BadgeTone = isLow ? "warn" : "info";
  return (
    <AdminBadge tone={tone}>
      {t("admin.intros.statusAuto", { confidence: confidencePct })}
    </AdminBadge>
  );
}
