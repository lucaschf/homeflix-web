import { Box, ButtonBase, Collapse, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Check, ChevronRight, Clock, History, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIntroDetectionRuns } from "../../api/hooks";
import type { AdminIntroDetectionRun } from "../../api/types";
import {
  AdminBadge,
  AdminCard,
  AdminPageHeader,
  AdminTablePagination,
  FancyEmpty,
  type BadgeTone,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { peach } from "../../theme/colors";
import { inkAlpha, scrim, status, whiteAlpha } from "../../theme/tokens";
import { parseServerDate } from "../../utils/datetime";
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
  const d = parseServerDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Admin Intro Detection runs — append-only audit history of the
 * detection job. Each row expands to a per-episode breakdown showing
 * the detected confidence and whether the marker was persisted (or
 * dropped below the confidence floor). Answers "it detected but
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
        <AdminCard padding={0}>
          <Box sx={{ px: 2.75, py: 2, borderBottom: `1px solid ${whiteAlpha(0.08)}` }}>
            <Stack direction="row" alignItems="center" spacing={1.125}>
              <Clock size={16} color={peach.main} style={{ flexShrink: 0 }} />
              <Typography variant="h3" component="h3">
                {t("admin.introRuns.history.title")}
              </Typography>
            </Stack>
            <Typography variant="cardSubtitle" color="text.secondary" sx={{ mt: 0.5 }}>
              {t("admin.introRuns.history.subtitle")}
            </Typography>
          </Box>

          {runs.isLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2.75 }}>
              {t("admin.introRuns.loading")}
            </Typography>
          ) : runs.isError ? (
            <Typography variant="body2" color="error" sx={{ p: 2.75 }}>
              {t("admin.introRuns.error")}
            </Typography>
          ) : (
            <Box>
              {runs.items.map((run, i) => (
                <RunRow
                  key={run.id}
                  run={run}
                  locale={i18n.language}
                  last={i === runs.items.length - 1}
                />
              ))}
            </Box>
          )}

          {(runs.items.length > 0 || runs.canGoPrevious) && (
            <Box sx={{ px: 1.75, borderTop: `1px solid ${whiteAlpha(0.08)}` }}>
              <AdminTablePagination
                pageNumber={runs.pageNumber}
                canGoNext={runs.canGoNext}
                canGoPrevious={runs.canGoPrevious}
                onNext={runs.goNext}
                onPrevious={runs.goPrevious}
                isFetching={runs.isFetching}
                pageSize={pageSize}
                pageSizeOptions={[10, 25, 50]}
                onPageSizeChange={setPageSize}
              />
            </Box>
          )}
        </AdminCard>
      )}
    </>
  );
}

function RunRow({
  run,
  locale,
  last,
}: {
  run: AdminIntroDetectionRun;
  locale: string;
  last: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const algorithm = ALGORITHM_LABELS[run.algorithm] ?? run.algorithm;
  const floorPct = Math.round(run.min_confidence * 100);

  return (
    <Box sx={{ borderBottom: last && !open ? "none" : `1px solid ${whiteAlpha(0.045)}` }}>
      <ButtonBase
        type="button"
        onClick={() => setOpen((v) => !v)}
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 1.75,
          px: 2.75,
          height: 60,
          bgcolor: open ? whiteAlpha(0.022) : "transparent",
          color: "text.primary",
          fontFamily: "inherit",
          textAlign: "left",
          transition: "background-color 100ms ease",
          "&:hover": { bgcolor: whiteAlpha(0.022) },
        }}
      >
        <ChevronRight
          size={15}
          style={{
            flexShrink: 0,
            color: inkAlpha(0.45),
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 160ms ease",
          }}
        />
        <Stack sx={{ width: 188, flexShrink: 0, minWidth: 0, gap: 0.1 }}>
          <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: 600 }} noWrap>
            {run.series_title || t("admin.introRuns.unknownSeries")}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
            {t("admin.introRuns.seasonLabel", { number: run.season_number })}
          </Typography>
        </Stack>
        <AdminBadge tone="info">{algorithm}</AdminBadge>
        <AdminBadge tone={outcomeTone(run.outcome)}>
          {t(`admin.introRuns.outcome.${run.outcome}`, { defaultValue: run.outcome })}
        </AdminBadge>
        <Typography
          variant="metaMono"
          noWrap
          sx={{ fontSize: "0.875rem", color: inkAlpha(0.55), flex: 1, minWidth: 0 }}
        >
          {t("admin.introRuns.countLabelDetected")}{" "}
          <Box component="span" sx={{ color: "text.primary" }}>
            {run.detected_count}
          </Box>
          {" · "}
          {t("admin.introRuns.countLabelSaved")}{" "}
          <Box
            component="span"
            sx={{ color: run.persisted_count > 0 ? status.ok.fg : inkAlpha(0.55) }}
          >
            {run.persisted_count}
          </Box>
          {" · "}
          {t("admin.introRuns.minConfidence", { value: floorPct })}
        </Typography>
        <Typography variant="metaMono" sx={{ fontSize: "0.875rem", color: "text.secondary", flexShrink: 0 }}>
          {formatWhen(run.finished_at, locale)}
        </Typography>
      </ButtonBase>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ pl: 6.375, pr: 2.75, pb: 2.5, pt: 0.5, bgcolor: scrim(0.18) }}>
          {run.error ? (
            <Typography variant="body2" color="error" sx={{ py: 1.5 }}>
              {run.error}
            </Typography>
          ) : run.episode_results.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
              {t("admin.introRuns.noEpisodes")}
            </Typography>
          ) : (
            <>
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ py: 1.5 }}
              >
                <Typography variant="eyebrow" sx={{ color: "text.secondary" }}>
                  {t("admin.introRuns.analyzed", { count: run.analyzed_count })}
                </Typography>
                <Typography variant="eyebrow" sx={{ color: "text.secondary" }}>
                  {t("admin.introRuns.confidenceFloor", { value: floorPct })}
                </Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
                  gap: 1,
                }}
              >
                {run.episode_results.map((ep) => {
                  const confPct = Math.round(ep.confidence * 100);
                  return (
                    <Box
                      key={ep.episode_id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        px: 1.375,
                        py: 1,
                        borderRadius: 1.5,
                        bgcolor: whiteAlpha(0.025),
                        border: `1px solid ${
                          ep.persisted ? alpha(status.ok.base, 0.22) : whiteAlpha(0.08)
                        }`,
                      }}
                    >
                      <Typography
                        variant="metaMono"
                        sx={{ fontSize: "0.875rem", width: 30, flexShrink: 0, color: "text.secondary" }}
                      >
                        {t("detail.episode", { number: ep.episode_number })}
                      </Typography>
                      <Box
                        sx={{
                          flex: 1,
                          height: 4,
                          bgcolor: whiteAlpha(0.07),
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${confPct}%`,
                            height: "100%",
                            bgcolor: ep.persisted ? status.ok.fg : inkAlpha(0.3),
                            borderRadius: 2,
                          }}
                        />
                      </Box>
                      <Typography
                        variant="metaMono"
                        sx={{
                          fontSize: "0.875rem",
                          width: 38,
                          flexShrink: 0,
                          textAlign: "right",
                          color: ep.persisted ? status.ok.fg : "text.secondary",
                        }}
                      >
                        {confPct}%
                      </Typography>
                      {ep.persisted ? (
                        <Check size={13} color={status.ok.fg} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                      ) : (
                        <X size={12} color={inkAlpha(0.45)} style={{ flexShrink: 0 }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
