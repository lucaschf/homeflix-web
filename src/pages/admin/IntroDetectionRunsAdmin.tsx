import { Box, Collapse, Stack, Typography } from "@mui/material";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIntroDetectionRuns } from "../../api/hooks";
import type { AdminIntroDetectionRun } from "../../api/types";
import {
  AdminBadge,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  AdminTablePagination,
  FancyEmpty,
  type BadgeTone,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { inkAlpha, whiteAlpha } from "../../theme/tokens";
import { IntroTabs } from "./components/IntroTabs";

const ALGORITHM_LABELS: Record<string, string> = {
  frame_hash: "Frame hash",
  chromaprint: "Chromaprint",
};

function outcomeTone(outcome: string): BadgeTone {
  switch (outcome) {
    case "COMPLETED":
      return "ok";
    case "FAILED":
      return "err";
    default:
      return "neutral";
  }
}

function formatWhen(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Admin Intro Detection runs — append-only audit history of the
 * detection job. Each row expands to a per-episode breakdown showing
 * the detected span, confidence, and whether the marker was persisted
 * (or dropped below the confidence floor). Answers "it detected but
 * nothing showed up".
 */
export function IntroDetectionRunsAdmin() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("admin.introRuns.title"));
  const [pageSize, setPageSize] = useState(10);
  const runs = useIntroDetectionRuns({}, { pageSize });

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.intros")]}
        title={t("admin.introRuns.title")}
        subtitle={t("admin.introRuns.subtitle")}
        toolbar={<IntroTabs />}
      />

      {!runs.isLoading && !runs.isError && runs.items.length === 0 && !runs.canGoPrevious ? (
        <FancyEmpty icon={History} motif="rows" title={t("admin.introRuns.empty")} />
      ) : (
        <AdminCard>
          <AdminCardHeader
            icon={History}
            title={t("admin.introRuns.history.title")}
            subtitle={t("admin.introRuns.history.subtitle")}
          />

          {runs.isLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t("admin.introRuns.loading")}
            </Typography>
          ) : runs.isError ? (
            <Typography variant="body2" color="error" sx={{ py: 2 }}>
              {t("admin.introRuns.error")}
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {runs.items.map((run) => (
                <RunRow key={run.id} run={run} locale={i18n.language} />
              ))}
            </Stack>
          )}

          {(runs.items.length > 0 || runs.canGoPrevious) && (
            <AdminTablePagination
              pageNumber={runs.pageNumber}
              canGoNext={runs.canGoNext}
              canGoPrevious={runs.canGoPrevious}
              onNext={runs.goNext}
              onPrevious={runs.goPrevious}
              isFetching={runs.isFetching}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          )}
        </AdminCard>
      )}
    </>
  );
}

function RunRow({ run, locale }: { run: AdminIntroDetectionRun; locale: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const algorithm = ALGORITHM_LABELS[run.algorithm] ?? run.algorithm;

  return (
    <Box
      sx={{
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 1.5,
          py: 1.25,
          bgcolor: "transparent",
          border: "none",
          color: "text.primary",
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          transition: "background-color 120ms ease",
          "&:hover": { bgcolor: whiteAlpha(0.04) },
        }}
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <Stack sx={{ minWidth: 140, flexShrink: 1, gap: 0.1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {run.series_title || t("admin.introRuns.unknownSeries")}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {t("admin.introRuns.seasonLabel", { number: run.season_number })}
          </Typography>
        </Stack>
        <AdminBadge tone="info">{algorithm}</AdminBadge>
        <AdminBadge tone={outcomeTone(run.outcome)}>
          {t(`admin.introRuns.outcome.${run.outcome}`, { defaultValue: run.outcome })}
        </AdminBadge>
        <Typography variant="metaMono" sx={{ color: inkAlpha(0.7) }}>
          {t("admin.introRuns.counts", {
            detected: run.detected_count,
            persisted: run.persisted_count,
          })}
        </Typography>
        <Typography variant="metaMono" sx={{ color: inkAlpha(0.6) }}>
          {t("admin.introRuns.minConfidence", {
            value: Math.round(run.min_confidence * 100),
          })}
        </Typography>
        <Typography
          variant="metaMono"
          sx={{ color: "text.secondary", ml: "auto" }}
        >
          {formatWhen(run.finished_at, locale)}
        </Typography>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${whiteAlpha(0.06)}` }}>
          {run.error ? (
            <Typography variant="body2" color="error">
              {run.error}
            </Typography>
          ) : run.episode_results.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("admin.introRuns.noEpisodes")}
            </Typography>
          ) : (
            <Stack spacing={0.25}>
              {run.episode_results.map((ep) => (
                <Box
                  key={ep.episode_id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <Typography
                    variant="metaMono"
                    sx={{ width: 48, color: "text.secondary" }}
                  >
                    {t("detail.episode", { number: ep.episode_number })}
                  </Typography>
                  <Typography variant="metaMono" sx={{ width: 120 }}>
                    {formatSeconds(ep.start_seconds)} → {formatSeconds(ep.end_seconds)}
                  </Typography>
                  <Typography
                    variant="metaMono"
                    sx={{ width: 56, color: inkAlpha(0.7) }}
                  >
                    {Math.round(ep.confidence * 100)}%
                  </Typography>
                  <AdminBadge tone={ep.persisted ? "ok" : "warn"}>
                    {ep.persisted
                      ? t("admin.introRuns.persisted")
                      : t("admin.introRuns.dropped")}
                  </AdminBadge>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
