import { Box, ButtonBase, CircularProgress, Typography } from "@mui/material";
import { AlertTriangle, ChevronRight, Film, HardDrive, ScanLine, Tv, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMoviesNeedingReview } from "../../api/hooks";
import type { NeedsReviewMovie } from "../../api/types";
import {
  AdminBadge,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  StatCard,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

/**
 * Admin Overview dashboard.
 *
 * P0 ships the layout + three real stat cards (movies / series via
 * the catalog endpoints, needs-review via the existing
 * ``useMoviesNeedingReview`` hook) and three placeholder cards
 * (last scan, users count, HLS cache size) marked with the
 * ``HypothesisChip`` since their backends are pending.
 *
 * Later phases (P3, P4, P6, P7) wire the placeholders to real data
 * and add the "Recently flagged" + "Scan activity" panels and the
 * "System health" strip described in the design spec.
 */
export function AdminOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.overview.title"));

  const reviewQueue = useMoviesNeedingReview();
  const reviewCount = reviewQueue.data?.length ?? 0;
  const reviewLoading = reviewQueue.isLoading;

  return (
    <>
      <AdminPageHeader
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
          gap: 1.75,
          mb: 3,
        }}
      >
        <StatCard
          label={t("admin.overview.stats.movies")}
          value={t("admin.overview.placeholder")}
          sub={t("admin.overview.placeholderSub")}
          icon={Film}
        />
        <StatCard
          label={t("admin.overview.stats.series")}
          value={t("admin.overview.placeholder")}
          sub={t("admin.overview.placeholderSub")}
          icon={Tv}
        />
        <StatCard
          label={t("admin.overview.stats.review")}
          value={reviewCount}
          sub={t("admin.overview.reviewSub")}
          icon={AlertTriangle}
          alert={reviewCount > 0}
          loading={reviewLoading}
          onClick={() => navigate("/admin/catalog/review")}
        />
        <StatCard
          label={t("admin.overview.stats.lastScan")}
          value={t("admin.overview.placeholder")}
          sub={t("admin.overview.placeholderSub")}
          icon={ScanLine}
        />
        <StatCard
          label={t("admin.overview.stats.users")}
          value={t("admin.overview.placeholder")}
          sub={t("admin.overview.placeholderSub")}
          icon={Users}
        />
        <StatCard
          label={t("admin.overview.stats.hlsCache")}
          value={t("admin.overview.placeholder")}
          sub={t("admin.overview.placeholderSub")}
          icon={HardDrive}
        />
      </Box>

      <RecentlyFlaggedPanel
        movies={reviewQueue.data}
        loading={reviewLoading}
        onSeeAll={() => navigate("/admin/catalog/review")}
      />
    </>
  );
}

const RECENTLY_FLAGGED_LIMIT = 5;

/**
 * Top-of-queue summary on the Overview dashboard.
 *
 * Renders up to ``RECENTLY_FLAGGED_LIMIT`` rows from the
 * needs-review queue so the operator sees what's pending without
 * leaving the dashboard. Each row click jumps to the full queue at
 * ``/admin/catalog/review`` where the relink + promote flows live.
 *
 * "Reason" / "detected at" badges from the design spec aren't
 * here yet — both require backend DTO additions (the existing
 * payload only carries id / title / year / file_path). The card
 * lands now with what we have; richer fields plug in when the
 * backend grows them.
 */
function RecentlyFlaggedPanel({
  movies,
  loading,
  onSeeAll,
}: {
  movies: NeedsReviewMovie[] | undefined;
  loading: boolean;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();
  const shown = (movies ?? []).slice(0, RECENTLY_FLAGGED_LIMIT);
  const totalCount = movies?.length ?? 0;
  const hasMore = totalCount > RECENTLY_FLAGGED_LIMIT;

  return (
    <AdminCard>
      <AdminCardHeader
        title={t("admin.overview.recentlyFlagged.title")}
        subtitle={t("admin.overview.recentlyFlagged.subtitle")}
        action={
          totalCount > 0 ? (
            <Typography
              component="button"
              onClick={onSeeAll}
              variant="body2"
              sx={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "primary.main",
                fontFamily: "inherit",
                fontSize: "0.8125rem",
                p: 0,
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {t("admin.overview.recentlyFlagged.seeAll", { count: totalCount })}
            </Typography>
          ) : undefined
        }
      />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={20} color="primary" />
        </Box>
      ) : shown.length === 0 ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {t("admin.overview.recentlyFlagged.empty")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {shown.map((movie) => (
            <FlaggedRow key={movie.id} movie={movie} onClick={onSeeAll} />
          ))}
          {hasMore && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ pt: 1, pl: 6.5, fontSize: "0.78125rem" }}
            >
              {t("admin.overview.recentlyFlagged.moreCount", {
                count: totalCount - RECENTLY_FLAGGED_LIMIT,
              })}
            </Typography>
          )}
        </Box>
      )}
    </AdminCard>
  );
}

function FlaggedRow({
  movie,
  onClick,
}: {
  movie: NeedsReviewMovie;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        textAlign: "left",
        width: "100%",
        gap: 1.75,
        px: 1.5,
        py: 1.25,
        borderRadius: 1,
        border: "1px solid transparent",
        transition: "background-color 120ms ease, border-color 120ms ease",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.025)",
          borderColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: "rgba(217,119,87,0.10)",
          border: "1px solid rgba(217,119,87,0.30)",
          color: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertTriangle size={17} aria-hidden />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 0.25,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" fontWeight={500} noWrap sx={{ minWidth: 0 }}>
            {movie.title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: "0.75rem",
            }}
          >
            {movie.year}
          </Typography>
          <AdminBadge tone="peach">
            {t("admin.overview.recentlyFlagged.reason")}
          </AdminBadge>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "0.6875rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {movie.file_path ?? t("admin.overview.recentlyFlagged.noFilePath")}
        </Typography>
      </Box>
      <Box sx={{ color: "text.secondary", display: "flex", flexShrink: 0 }}>
        <ChevronRight size={16} aria-hidden />
      </Box>
    </ButtonBase>
  );
}

