import { useEffect, useMemo, useState } from "react";
import {
  Box,
  ButtonBase,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Check, ChevronDown, Pencil, RefreshCw, Search, Tv } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useListAllSeries,
  useResetSeasonIntroDetection,
  useSeriesDetail,
} from "../../api/hooks";
import type { EpisodeOutput, SeriesDetail, SeriesSummary } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminDialog,
  AdminPageHeader,
  type BadgeTone,
  FancyEmpty,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { peach } from "../../theme/colors";
import { fontFamily, fontSize, inkAlpha, peachAlpha, status, whiteAlpha, toastSurfaceSx } from "../../theme/tokens";
import { IntroTabs } from "./components/IntroTabs";

type IntroFilter = "all" | "marked" | "unmarked" | "auto" | "low_confidence" | "manual";
type SeriesFilter = "all" | "pending" | "done";

// Confidence threshold below which an auto marker is considered
// shaky enough to surface in the "low confidence" triage filter.
// Picked from a quick eyeball of recent detections — anything under
// 0.7 in our current pipeline tends to land on the wrong frame.
const LOW_CONFIDENCE_THRESHOLD = 0.7;
// At/above this the marker is treated as solid — the confidence
// readout goes green to signal "no review needed".
const HIGH_CONFIDENCE_THRESHOLD = 0.95;
const SEARCH_DEBOUNCE_MS = 300;
const RAIL_WIDTH = 340;
// Shared height for the header controls (filter + re-detect) and the
// season selector chips so they line up on the same baseline.
const CONTROL_HEIGHT = 38;

function fmtClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** A series has full coverage once every episode carries an intro marker. */
function isSeriesDone(s: SeriesSummary): boolean {
  return s.total_episodes > 0 && (s.intro_marked_count ?? 0) >= s.total_episodes;
}

function matchesFilter(intro: EpisodeOutput["intro"], filter: IntroFilter): boolean {
  switch (filter) {
    case "marked":
      return intro !== null;
    case "unmarked":
      return intro === null;
    case "auto":
      return intro?.source === "AUTO_DETECTED";
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
  const [seriesFilter, setSeriesFilter] = useState<SeriesFilter>("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { items: allSeries, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useListAllSeries();

  const searchedSeries = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return allSeries;
    return allSeries.filter((s) => s.title.toLowerCase().includes(q));
  }, [allSeries, debouncedSearch]);

  const doneCount = useMemo(() => searchedSeries.filter(isSeriesDone).length, [searchedSeries]);

  const visibleSeries = useMemo(() => {
    if (seriesFilter === "done") return searchedSeries.filter(isSeriesDone);
    if (seriesFilter === "pending") return searchedSeries.filter((s) => !isSeriesDone(s));
    return searchedSeries;
  }, [searchedSeries, seriesFilter]);

  const { data: seriesDetail } = useSeriesDetail(selectedSeriesId ?? "");

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.intros")]}
        title={t("admin.intros.title")}
        subtitle={t("admin.intros.subtitle")}
        toolbar={<IntroTabs />}
      />

      <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
        {/* ── Series rail ─────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: "auto" }}>
          <AdminCard
            padding={0}
            sx={{
              width: { xs: "100%", md: RAIL_WIDTH },
              display: "flex",
              flexDirection: "column",
              position: { md: "sticky" },
              top: 0,
              maxHeight: "calc(100vh - 220px)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: 1.5, borderBottom: `1px solid ${whiteAlpha(0.08)}` }}>
              <SeriesSearch value={searchInput} onChange={setSearchInput} />
              <SeriesSegmentedFilter
                value={seriesFilter}
                onChange={setSeriesFilter}
                counts={{
                  all: searchedSeries.length,
                  pending: searchedSeries.length - doneCount,
                  done: doneCount,
                }}
              />
            </Box>

            <Box sx={{ overflowY: "auto", flex: 1 }}>
              {isLoading ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "1rem", p: 2 }}>
                  {t("admin.intros.loading")}
                </Typography>
              ) : visibleSeries.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: "1rem", p: 4, textAlign: "center" }}
                >
                  {debouncedSearch
                    ? t("admin.intros.noResults")
                    : seriesFilter === "done"
                      ? t("admin.intros.noDoneSeries")
                      : seriesFilter === "pending"
                        ? t("admin.intros.noPendingSeries")
                        : t("admin.intros.noSeries")}
                </Typography>
              ) : (
                visibleSeries.map((s) => (
                  <SeriesRailItem
                    key={s.id}
                    series={s}
                    active={s.id === selectedSeriesId}
                    onSelect={() => {
                      setSelectedSeriesId(s.id);
                      setFilter("all");
                    }}
                  />
                ))
              )}
              {hasNextPage && (
                <Box sx={{ p: 1.5, borderTop: `1px solid ${whiteAlpha(0.06)}` }}>
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
        </Grid>

        {/* ── Detail panel ────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: "grow" }} sx={{ minWidth: 0 }}>
          {seriesDetail ? (
            <AdminCard
              padding={0}
              sx={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto", overflowX: "hidden" }}
            >
              <SeriesEpisodes
                key={seriesDetail.id}
                detail={seriesDetail}
                filter={filter}
                onFilterChange={setFilter}
              />
            </AdminCard>
          ) : (
            <FancyEmpty icon={Tv} motif="cards" title={t("admin.intros.selectSeriesHint")} />
          )}
        </Grid>
      </Grid>
    </>
  );
}

function SeriesSearch({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.125,
        px: 1.375,
        py: 1,
        bgcolor: whiteAlpha(0.03),
        border: `1px solid ${whiteAlpha(0.08)}`,
        borderRadius: "8px",
        color: "text.secondary",
        transition: "border-color 120ms ease",
        "&:focus-within": { borderColor: whiteAlpha(0.16) },
      }}
    >
      <Search size={16} aria-hidden style={{ flexShrink: 0 }} />
      <Box
        component="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("admin.intros.searchSeries")}
        sx={{
          flex: 1,
          minWidth: 0,
          bgcolor: "transparent",
          border: 0,
          outline: "none",
          color: "text.primary",
          fontFamily: "inherit",
          fontSize: "1rem",
          "&::placeholder": { color: "text.secondary", opacity: 1 },
        }}
      />
    </Box>
  );
}

interface SeriesSegmentedFilterProps {
  value: SeriesFilter;
  onChange: (next: SeriesFilter) => void;
  counts: Record<SeriesFilter, number>;
}

function SeriesSegmentedFilter({ value, onChange, counts }: SeriesSegmentedFilterProps) {
  const { t } = useTranslation();
  const segments: { id: SeriesFilter; label: string }[] = [
    { id: "all", label: t("admin.intros.segmentAll") },
    { id: "pending", label: t("admin.intros.segmentPending") },
    { id: "done", label: t("admin.intros.segmentDone") },
  ];
  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        mt: 1.25,
        p: "3px",
        bgcolor: whiteAlpha(0.03),
        border: `1px solid ${whiteAlpha(0.08)}`,
        borderRadius: "8px",
      }}
    >
      {segments.map((seg) => {
        const on = value === seg.id;
        return (
          <ButtonBase
            key={seg.id}
            type="button"
            onClick={() => onChange(seg.id)}
            sx={{
              flex: 1,
              gap: 0.625,
              py: 0.75,
              px: 0.5,
              borderRadius: "6px",
              bgcolor: on ? peachAlpha(0.13) : "transparent",
              color: on ? peach.main : inkAlpha(0.55),
              fontFamily: "inherit",
              fontSize: fontSize.control,
              fontWeight: on ? 600 : 500,
              transition: "background-color 120ms ease, color 120ms ease",
              "&:hover": { color: on ? peach.main : "text.primary" },
            }}
          >
            {seg.label}
            <Box
              component="span"
              sx={{
                fontFamily: fontFamily.mono,
                fontSize: "0.6875rem",
                color: on ? peach.main : "text.secondary",
              }}
            >
              {counts[seg.id]}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

interface SeriesRailItemProps {
  series: SeriesSummary;
  active: boolean;
  onSelect: () => void;
}

function SeriesRailItem({ series, active, onSelect }: SeriesRailItemProps) {
  const done = isSeriesDone(series);
  const markedCount = series.intro_marked_count ?? 0;
  const ratio = series.total_episodes > 0 ? markedCount / series.total_episodes : 0;
  return (
    <ButtonBase
      type="button"
      onClick={onSelect}
      sx={{
        position: "relative",
        width: "100%",
        display: "block",
        textAlign: "left",
        px: 2,
        py: 1.25,
        bgcolor: active ? peachAlpha(0.07) : "transparent",
        borderBottom: `1px solid ${whiteAlpha(0.04)}`,
        fontFamily: "inherit",
        transition: "background-color 120ms ease",
        "&:hover": { bgcolor: active ? peachAlpha(0.07) : whiteAlpha(0.025) },
      }}
    >
      {active && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            bgcolor: "primary.main",
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.25 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{
            fontSize: "1rem",
            fontWeight: active ? 600 : 500,
            color: active ? "primary.main" : "text.primary",
          }}
        >
          {series.title}
        </Typography>
        {done && <Check size={15} color={status.ok.fg} strokeWidth={2.4} style={{ flexShrink: 0 }} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.875 }}>
        <Box sx={{ flex: 1, height: 3, bgcolor: whiteAlpha(0.07), borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              width: `${ratio * 100}%`,
              height: "100%",
              bgcolor: done ? status.ok.fg : "primary.main",
              borderRadius: 2,
            }}
          />
        </Box>
        <Typography
          variant="metaMono"
          sx={{ fontSize: "0.875rem", color: "text.secondary", flexShrink: 0 }}
        >
          {markedCount}/{series.total_episodes}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

interface SeriesEpisodesProps {
  detail: SeriesDetail;
  filter: IntroFilter;
  onFilterChange: (next: IntroFilter) => void;
}

function SeriesEpisodes({ detail, filter, onFilterChange }: SeriesEpisodesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reset = useResetSeasonIntroDetection();
  const [activeSeasonNumber, setActiveSeasonNumber] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ severity: "success" | "error"; message: string } | null>(
    null,
  );

  const filterOptions: { label: string; value: IntroFilter }[] = [
    { label: t("admin.intros.filterAll"), value: "all" },
    { label: t("admin.intros.filterMarked"), value: "marked" },
    { label: t("admin.intros.filterUnmarked"), value: "unmarked" },
    { label: t("admin.intros.filterAuto"), value: "auto" },
    { label: t("admin.intros.filterLowConfidence"), value: "low_confidence" },
    { label: t("admin.intros.filterManual"), value: "manual" },
  ];

  const seasons = detail.seasons;
  const activeSeason = seasons.find((s) => s.season_number === activeSeasonNumber) ?? seasons[0];

  const seasonLabel = (n: number) =>
    n === 0 ? t("admin.intros.specials") : t("admin.intros.season", { number: n });

  if (!activeSeason) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: "1rem", p: 4, textAlign: "center" }}>
        {t("admin.intros.noSeries")}
      </Typography>
    );
  }

  const episodes = activeSeason.episodes;
  const totalEpisodes = episodes.length;
  const markedCount = episodes.filter((e) => e.intro !== null).length;
  const manualCount = episodes.filter((e) => e.intro?.source === "MANUAL").length;
  const pct = totalEpisodes > 0 ? markedCount / totalEpisodes : 0;
  const visibleEpisodes = episodes.filter((e) => matchesFilter(e.intro, filter));

  const onRedetect = () => {
    if (!activeSeason.id) return;
    reset.mutate(
      { seasonId: activeSeason.id, seriesId: detail.id },
      {
        onSuccess: (res) => {
          setConfirmOpen(false);
          setToast({
            severity: "success",
            message: t("admin.intros.redetectQueued", { count: res.data.markers_cleared }),
          });
        },
        onError: () => {
          setConfirmOpen(false);
          setToast({ severity: "error", message: t("admin.intros.redetectFailed") });
        },
      },
    );
  };

  return (
    <>
      {/* Detail header */}
      <Box sx={{ px: 2.75, py: 2.25, borderBottom: `1px solid ${whiteAlpha(0.08)}` }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2.25,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ minWidth: 0, flex: "1 1 240px" }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Tv size={18} color={peach.main} style={{ flexShrink: 0 }} />
              <Typography variant="h2" component="h2" noWrap sx={{ minWidth: 0 }}>
                {detail.title}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1.75} sx={{ mt: 1.125, flexWrap: "wrap" }}>
              <Typography variant="eyebrow" component="span" sx={{ color: "text.secondary" }}>
                {seasonLabel(activeSeason.season_number)} ·{" "}
                {t("common.episodes", { count: totalEpisodes })}
              </Typography>
              <MetaDot color={status.ok.fg} label={t("admin.intros.marked", { count: markedCount })} />
              <MetaDot color={peach.main} label={t("admin.intros.manualMarkers", { count: manualCount })} />
            </Stack>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
            <EpisodeFilterMenu value={filter} options={filterOptions} onChange={onFilterChange} />
            <Tooltip title={t("admin.intros.redetectHint")}>
              <span>
                <AdminButton
                  variant="secondary"
                  icon={<RefreshCw size={14} />}
                  onClick={() => setConfirmOpen(true)}
                  disabled={!activeSeason.id || reset.isPending}
                  sx={{ height: CONTROL_HEIGHT, py: 0 }}
                >
                  {t("admin.intros.redetect")}
                </AdminButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {/* Progress strip */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 2 }}>
          <Box sx={{ flex: 1, height: 5, bgcolor: whiteAlpha(0.06), borderRadius: 1.5, overflow: "hidden" }}>
            <Box
              sx={{
                width: `${pct * 100}%`,
                height: "100%",
                bgcolor: pct >= 1 ? status.ok.fg : "primary.main",
                borderRadius: 1.5,
                transition: "width 240ms ease",
              }}
            />
          </Box>
          <Typography variant="metaMono" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
            {Math.round(pct * 100)}%
          </Typography>
        </Stack>
      </Box>

      {/* Season selector */}
      {seasons.length > 1 && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 2.75,
            py: 1.5,
            borderBottom: `1px solid ${whiteAlpha(0.08)}`,
            bgcolor: whiteAlpha(0.012),
            flexWrap: "wrap",
            rowGap: 1,
          }}
        >
          <Typography variant="eyebrow" sx={{ color: "text.secondary", mr: 0.5 }}>
            {t("admin.intros.seasonsCount", { count: seasons.length })}
          </Typography>
          {seasons.map((se) => {
            const on = se.season_number === activeSeason.season_number;
            return (
              <ButtonBase
                key={se.season_number}
                type="button"
                onClick={() => {
                  setActiveSeasonNumber(se.season_number);
                  onFilterChange("all");
                }}
                sx={{
                  gap: 0.875,
                  height: CONTROL_HEIGHT,
                  px: 1.625,
                  borderRadius: "7px",
                  bgcolor: on ? peachAlpha(0.12) : whiteAlpha(0.03),
                  border: `1px solid ${on ? peachAlpha(0.4) : whiteAlpha(0.08)}`,
                  color: on ? peach.main : inkAlpha(0.7),
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  fontWeight: on ? 600 : 500,
                  transition: "all 120ms ease",
                  "&:hover": { color: on ? peach.main : "text.primary" },
                }}
              >
                {se.season_number === 0 ? t("admin.intros.specials") : `T${se.season_number}`}
                <Box
                  component="span"
                  sx={{
                    fontFamily: fontFamily.mono,
                    fontSize: "0.875rem",
                    color: on ? peach.main : "text.secondary",
                  }}
                >
                  {t("common.episodes", { count: se.episodes.length })}
                </Box>
              </ButtonBase>
            );
          })}
        </Stack>
      )}

      {/* Episode rows */}
      {visibleEpisodes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "1rem", py: 6, textAlign: "center" }}>
          {t("admin.intros.noEpisodesForFilter")}
        </Typography>
      ) : (
        visibleEpisodes.map((ep, i) => (
          <EpisodeRow
            key={`${activeSeason.season_number}-${ep.episode_number}`}
            episode={ep}
            last={i === visibleEpisodes.length - 1}
            onEdit={() =>
              navigate(
                `/admin/intros/${detail.id}/${activeSeason.season_number}/${ep.episode_number}`,
              )
            }
          />
        ))
      )}

      <AdminDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
          {t("admin.intros.redetectConfirmTitle")}
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          <Typography variant="body2" sx={{ fontSize: "1rem", color: inkAlpha(0.72) }}>
            {t("admin.intros.redetectConfirm", { season: activeSeason.season_number })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1.25 }}>
          <AdminButton variant="ghost" onClick={() => setConfirmOpen(false)} disabled={reset.isPending}>
            {t("admin.intros.cancel")}
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={onRedetect}
            disabled={reset.isPending}
            icon={reset.isPending ? <CircularProgress size={12} sx={{ color: "inherit" }} /> : undefined}
          >
            {reset.isPending ? t("admin.intros.redetectInProgress") : t("admin.intros.confirm")}
          </AdminButton>
        </DialogActions>
      </AdminDialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Box
            sx={{
              ...toastSurfaceSx(toast.severity),
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "1rem",
              maxWidth: 480,
            }}
          >
            {toast.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}

interface EpisodeFilterMenuProps {
  value: IntroFilter;
  options: { label: string; value: IntroFilter }[];
  onChange: (next: IntroFilter) => void;
}

/**
 * Header filter for the episode list. A bespoke dropdown (instead of
 * the shared pill-shaped ``FilterChip``) so it matches the square
 * 5px-radius hairline of the adjacent ``AdminButton`` — the global
 * primitive is left untouched for the rest of the admin surface.
 */
function EpisodeFilterMenu({ value, options, onChange }: EpisodeFilterMenuProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const active = options.findIndex((o) => o.value === value) > 0;
  const current = options.find((o) => o.value === value);
  return (
    <>
      <AdminButton
        variant="secondary"
        endIcon={<ChevronDown size={14} />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          minWidth: 156,
          height: CONTROL_HEIGHT,
          py: 0,
          justifyContent: "flex-start",
          "& .MuiButton-endIcon": { ml: "auto" },
          ...(active
            ? {
                bgcolor: peachAlpha(0.1),
                borderColor: peachAlpha(0.3),
                color: peach.main,
                "&:hover": { bgcolor: peachAlpha(0.14) },
              }
            : {}),
        }}
      >
        <Box component="span" sx={{ color: "text.secondary", mr: 0.75 }}>
          {t("admin.intros.filter")}:
        </Box>
        {current?.label}
      </AdminButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {options.map((o) => (
          <MenuItem
            key={o.value}
            selected={o.value === value}
            onClick={() => {
              onChange(o.value);
              setAnchorEl(null);
            }}
            sx={{ fontSize: fontSize.control, gap: 1 }}
          >
            <Box sx={{ width: 16, display: "flex", flexShrink: 0 }}>
              {o.value === value && <Check size={14} color={peach.main} />}
            </Box>
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function MetaDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="body2" sx={{ fontSize: "1rem", color: inkAlpha(0.6) }}>
        {label}
      </Typography>
    </Stack>
  );
}

interface EpisodeRowProps {
  episode: EpisodeOutput;
  last: boolean;
  onEdit: () => void;
}

function EpisodeRow({ episode, last, onEdit }: EpisodeRowProps) {
  const { t } = useTranslation();
  const intro = episode.intro;
  const unmarked = intro === null;
  const runtime = episode.duration_seconds || 0;
  const introLeft = !unmarked && runtime > 0 ? intro.start_seconds / runtime : 0;
  const introWidth = !unmarked && runtime > 0 ? (intro.end_seconds - intro.start_seconds) / runtime : 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "52px minmax(0,1fr) 300px 230px 44px",
        alignItems: "center",
        gap: 2,
        px: 3,
        height: 80,
        borderBottom: last ? "none" : `1px solid ${whiteAlpha(0.045)}`,
        transition: "background-color 100ms ease",
        "&:hover": { bgcolor: whiteAlpha(0.022) },
        "&:hover .intro-edit": {
          bgcolor: whiteAlpha(0.06),
          borderColor: whiteAlpha(0.08),
          color: "text.primary",
        },
      }}
    >
      <Typography variant="metaMono" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
        {t("detail.episode", { number: episode.episode_number })}
      </Typography>

      {/* Title + mini timeline */}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontSize: "1rem", fontWeight: 500, color: unmarked ? inkAlpha(0.6) : "text.primary" }}
        >
          {episode.title}
        </Typography>
        <Box
          sx={{
            position: "relative",
            height: 5,
            mt: 0.875,
            maxWidth: 260,
            bgcolor: whiteAlpha(0.06),
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          {!unmarked && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${introLeft * 100}%`,
                width: `${introWidth * 100}%`,
                minWidth: 6,
                bgcolor: intro.source === "MANUAL" ? peach.main : alpha(status.info.fg, 0.85),
                borderRadius: 2,
              }}
            />
          )}
        </Box>
      </Box>

      {/* Range */}
      <Typography
        variant="metaMono"
        noWrap
        sx={{ fontSize: "1rem", textAlign: "right", color: unmarked ? "text.secondary" : inkAlpha(0.85) }}
      >
        {unmarked ? (
          t("admin.intros.notMarked")
        ) : (
          <>
            <Box component="span" sx={{ color: "text.secondary" }}>
              {t("admin.intros.introWord")}
            </Box>{" "}
            {fmtClock(intro.start_seconds)}{" "}
            <Box component="span" sx={{ color: "text.secondary" }}>
              →
            </Box>{" "}
            {fmtClock(intro.end_seconds)}
          </>
        )}
      </Typography>

      {/* Source + confidence */}
      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={2.5}>
        <IntroBadge intro={intro} />
        {!unmarked && intro.source === "AUTO_DETECTED" && intro.confidence !== null && (
          <Typography
            variant="metaMono"
            sx={{
              fontSize: "1rem",
              minWidth: 42,
              textAlign: "right",
              color: intro.confidence >= HIGH_CONFIDENCE_THRESHOLD ? status.ok.fg : "text.secondary",
            }}
          >
            {Math.round(intro.confidence * 100)}%
          </Typography>
        )}
      </Stack>

      {/* Edit */}
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Tooltip title={t("admin.intros.edit")}>
          <span>
            <IconButton
              className="intro-edit"
              size="small"
              disabled={!episode.file_path}
              onClick={onEdit}
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                border: "1px solid transparent",
                color: "text.secondary",
                transition: "all 120ms ease",
              }}
            >
              <Pencil size={15} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

function IntroBadge({ intro }: { intro: EpisodeOutput["intro"] }) {
  const { t } = useTranslation();
  if (!intro) {
    return <AdminBadge tone="neutral">{t("admin.intros.statusPending")}</AdminBadge>;
  }
  if (intro.source === "MANUAL") {
    return <AdminBadge tone="peach">{t("admin.intros.statusManual")}</AdminBadge>;
  }
  const isLow = (intro.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD;
  const tone: BadgeTone = isLow ? "warn" : "info";
  return <AdminBadge tone={tone}>{t("admin.intros.filterAuto")}</AdminBadge>;
}
