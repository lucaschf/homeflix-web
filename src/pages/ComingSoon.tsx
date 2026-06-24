import {
  Box,
  ButtonBase,
  CircularProgress,
  Snackbar,
  Typography,
} from "@mui/material";
import { Bell, Plus } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  useComingSoon,
  useComingSoonSubscribe,
  useComingSoonUnsubscribe,
} from "../api/hooks";
import type { CatalogRequest } from "../api/types";
import { RequestTitleDialog } from "../components/RequestTitleDialog";
import { SoonCard } from "../components/SoonCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { peach } from "../theme/colors";
import { inkAlpha, peachAlpha, whiteAlpha } from "../theme/tokens";

type KindFilter = "all" | "movie" | "series";

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        px: 1.75,
        py: 0.75,
        borderRadius: "20px",
        gap: 0.75,
        fontSize: "0.8125rem",
        fontWeight: 500,
        border: `1px solid ${active ? "transparent" : whiteAlpha(0.1)}`,
        bgcolor: active ? "#F5F1EB" : "transparent",
        color: active ? "#0A0A0A" : inkAlpha(0.7),
        transition: "background-color 140ms ease, color 140ms ease",
        "&:hover": { color: active ? "#0A0A0A" : "text.primary" },
      }}
    >
      {children}
    </ButtonBase>
  );
}

/**
 * Member-facing "Em breve no HomeFlix" page — every title queued for
 * the catalog, with a per-title "Avisar quando chegar" toggle and a
 * "Sugerir um título" flow (ADR-022). One scrolled screen.
 */
export function ComingSoon() {
  const { t } = useTranslation();
  useDocumentTitle(t("comingSoon.title"));

  const { data, isLoading, isError, refetch } = useComingSoon();
  const subscribe = useComingSoonSubscribe();
  const unsubscribe = useComingSoonUnsubscribe();

  const [kind, setKind] = useState<KindFilter>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const all = data ?? [];
  const counts = {
    all: all.length,
    movie: all.filter((r) => r.media_type === "movie").length,
    series: all.filter((r) => r.media_type === "series").length,
  };
  const following = all.filter((r) => r.is_subscribed).length;
  const waiting = all.reduce((acc, r) => acc + (r.subscriber_count ?? 0), 0);
  const visible = all.filter(
    (r) =>
      (kind === "all" || r.media_type === kind) && (!onlyMine || r.is_subscribed),
  );

  const pendingTmdbId = subscribe.isPending
    ? subscribe.variables?.tmdb_id
    : unsubscribe.isPending
      ? unsubscribe.variables?.tmdb_id
      : undefined;

  const onToggle = async (r: CatalogRequest) => {
    try {
      if (r.is_subscribed) {
        await unsubscribe.mutateAsync({ tmdb_id: r.tmdb_id, media_type: r.media_type });
        setSnack(t("comingSoon.toast.unsubscribed"));
      } else {
        await subscribe.mutateAsync({
          tmdb_id: r.tmdb_id,
          media_type: r.media_type,
          title: r.title,
        });
        setSnack(t("comingSoon.toast.subscribed"));
      }
    } catch {
      setSnack(t("comingSoon.toast.error"));
    }
  };

  return (
    <Box sx={{ px: { xs: 3, md: 5 }, pt: { xs: 4, md: 6 }, pb: 12, width: "100%" }}>
      {/* Intro */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 3,
        }}
      >
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <Typography variant="eyebrow" sx={{ color: "primary.main", display: "block" }}>
            {t("comingSoon.eyebrow")}
          </Typography>
          <Typography
            variant="pageTitle"
            sx={{
              mt: 1.25,
              fontSize: { xs: "2.1rem", md: "3rem" },
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {t("comingSoon.title")}
          </Typography>
          <Typography variant="pageSubtitle" sx={{ mt: 2, color: inkAlpha(0.55) }}>
            <Trans
              i18nKey="comingSoon.subtitle"
              components={{ b: <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }} /> }}
            />
          </Typography>
        </Box>

        <ButtonBase
          onClick={() => setSuggestOpen(true)}
          sx={{
            px: 2,
            py: 1,
            gap: 0.75,
            borderRadius: "9px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "text.primary",
            border: `1px solid ${whiteAlpha(0.18)}`,
            "&:hover": { borderColor: peachAlpha(0.5), color: "primary.main" },
          }}
        >
          <Plus size={15} aria-hidden />
          {t("comingSoon.suggest")}
        </ButtonBase>
      </Box>

      {/* Stat strip */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: { xs: 2.5, md: 4 },
          mt: 4,
          pb: 3,
          borderBottom: `1px solid ${whiteAlpha(0.08)}`,
        }}
      >
        {[
          { value: counts.all, label: t("comingSoon.stats.incoming") },
          { value: following, label: t("comingSoon.stats.following"), peach: true },
          { value: waiting, label: t("comingSoon.stats.waiting") },
        ].map((stat, i) => (
          <Box key={i}>
            <Typography
              variant="statValue"
              sx={{ color: stat.peach ? "primary.main" : "text.primary", fontSize: "1.75rem" }}
            >
              {stat.value}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Filter bar */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          mt: 3,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <FilterPill active={kind === "all"} onClick={() => setKind("all")}>
            {t("comingSoon.filter.all")} · {counts.all}
          </FilterPill>
          <FilterPill active={kind === "movie"} onClick={() => setKind("movie")}>
            {t("comingSoon.filter.movies")} · {counts.movie}
          </FilterPill>
          <FilterPill active={kind === "series"} onClick={() => setKind("series")}>
            {t("comingSoon.filter.series")} · {counts.series}
          </FilterPill>
        </Box>

        <ButtonBase
          onClick={() => setOnlyMine((v) => !v)}
          sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: "20px",
            gap: 0.75,
            fontSize: "0.8125rem",
            fontWeight: 500,
            border: `1px solid ${onlyMine ? peachAlpha(0.5) : whiteAlpha(0.1)}`,
            bgcolor: onlyMine ? peachAlpha(0.12) : "transparent",
            color: onlyMine ? "primary.main" : inkAlpha(0.7),
          }}
        >
          <Bell size={13} aria-hidden />
          {t("comingSoon.filter.onlyMine")}
        </ButtonBase>
      </Box>

      {/* Grid */}
      <Box sx={{ mt: 4 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : isError ? (
          <EmptyState
            title={t("comingSoon.errorTitle")}
            body={t("comingSoon.errorBody")}
            onRetry={() => void refetch()}
            retryLabel={t("comingSoon.retry")}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t(onlyMine ? "comingSoon.emptyMineTitle" : "comingSoon.emptyTitle")}
            body={t(onlyMine ? "comingSoon.emptyMineBody" : "comingSoon.emptyBody")}
          />
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(auto-fill, minmax(150px, 1fr))",
                md: "repeat(auto-fill, minmax(210px, 1fr))",
              },
              gap: { xs: 2.5, md: 4 },
            }}
          >
            {visible.map((r) => (
              <SoonCard
                key={r.id}
                request={r}
                pending={pendingTmdbId === r.tmdb_id}
                onToggle={() => void onToggle(r)}
              />
            ))}
          </Box>
        )}
      </Box>

      <RequestTitleDialog open={suggestOpen} onClose={() => setSuggestOpen(false)} />

      <Snackbar
        open={!!snack}
        autoHideDuration={3400}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Box
            sx={{
              bgcolor: peachAlpha(0.14),
              border: `1px solid ${peachAlpha(0.3)}`,
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
            }}
          >
            {snack}
          </Box>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

function EmptyState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <Box sx={{ textAlign: "center", py: 10, color: "text.secondary" }}>
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          mx: "auto",
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: peachAlpha(0.1),
          color: peach.main,
        }}
      >
        <Bell size={24} aria-hidden />
      </Box>
      <Typography variant="h3" sx={{ color: "text.primary" }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, maxWidth: 380, mx: "auto" }}>
        {body}
      </Typography>
      {onRetry && (
        <ButtonBase
          onClick={onRetry}
          sx={{
            mt: 2.5,
            px: 2,
            py: 0.875,
            borderRadius: "8px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            border: `1px solid ${whiteAlpha(0.18)}`,
            color: "text.primary",
          }}
        >
          {retryLabel}
        </ButtonBase>
      )}
    </Box>
  );
}
