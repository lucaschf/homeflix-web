import { Box } from "@mui/material";
import { AlertTriangle, Film, HardDrive, ScanLine, Tv, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMoviesNeedingReview } from "../../api/hooks";
import { AdminPageHeader, StatCard } from "../../components/admin";
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
    </>
  );
}
