import { Box, ButtonBase, Collapse, Stack, Typography } from "@mui/material";
import { Check, ChevronRight, Clock, History, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSubtitleOcrRuns } from "../../api/hooks";
import type { AdminSubtitleOcrRun, AdminSubtitleTrackOcrResult } from "../../api/types";
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

function outcomeTone(outcome: string): BadgeTone {
  switch (outcome) {
    case "completed":
      return "ok";
    case "failed":
      return "err";
    default:
      return "neutral";
  }
}

function trackTone(outcome: string): BadgeTone {
  switch (outcome) {
    case "extracted":
      return "ok";
    case "failed":
      return "err";
    default:
      return "neutral";
  }
}

function languageName(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) return name;
  } catch {
    /* unknown code — fall through */
  }
  return code.toUpperCase();
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
 * Admin Subtitle OCR runs — append-only audit history of the OCR job and
 * the manual trigger. Each row expands to a per-track breakdown showing,
 * per image subtitle, its language, outcome, and how many cues were
 * extracted. Answers "which titles ran and what did we get out".
 */
export function SubtitleOcrRunsAdmin() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("admin.subtitleOcrRuns.title"));
  const [pageSize, setPageSize] = useState(10);
  const runs = useSubtitleOcrRuns({}, { pageSize });

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.subtitleOcr")]}
        title={t("admin.subtitleOcrRuns.title")}
        subtitle={t("admin.subtitleOcrRuns.subtitle")}
      />

      {!runs.isLoading && !runs.isError && runs.items.length === 0 && !runs.canGoPrevious ? (
        <FancyEmpty icon={History} motif="rows" title={t("admin.subtitleOcrRuns.empty")} />
      ) : (
        <AdminCard padding={0}>
          <Box sx={{ px: 2.75, py: 2, borderBottom: `1px solid ${whiteAlpha(0.08)}` }}>
            <Stack direction="row" alignItems="center" spacing={1.125}>
              <Clock size={16} color={peach.main} style={{ flexShrink: 0 }} />
              <Typography variant="h3" component="h3">
                {t("admin.subtitleOcrRuns.history.title")}
              </Typography>
            </Stack>
            <Typography variant="cardSubtitle" color="text.secondary" sx={{ mt: 0.5 }}>
              {t("admin.subtitleOcrRuns.history.subtitle")}
            </Typography>
          </Box>

          {runs.isLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2.75 }}>
              {t("admin.subtitleOcrRuns.loading")}
            </Typography>
          ) : runs.isError ? (
            <Typography variant="body2" color="error" sx={{ p: 2.75 }}>
              {t("admin.subtitleOcrRuns.error")}
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
  run: AdminSubtitleOcrRun;
  locale: string;
  last: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

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
        <Typography
          variant="body2"
          sx={{ fontSize: "1rem", fontWeight: 600, width: 260, flexShrink: 0 }}
          noWrap
        >
          {run.media_title || t("admin.subtitleOcrRuns.unknownMedia")}
        </Typography>
        <AdminBadge tone="info">{t(`admin.subtitleOcrRuns.kind.${run.media_kind}`, { defaultValue: run.media_kind })}</AdminBadge>
        <AdminBadge tone={outcomeTone(run.outcome)}>
          {t(`admin.subtitleOcrRuns.outcome.${run.outcome}`, { defaultValue: run.outcome })}
        </AdminBadge>
        <Typography
          variant="metaMono"
          noWrap
          sx={{ fontSize: "0.875rem", color: inkAlpha(0.55), flex: 1, minWidth: 0 }}
        >
          {t("admin.subtitleOcrRuns.tracksLabel")}{" "}
          <Box component="span" sx={{ color: "text.primary" }}>
            {run.image_track_count}
          </Box>
          {" · "}
          {t("admin.subtitleOcrRuns.extractedLabel")}{" "}
          <Box
            component="span"
            sx={{ color: run.extracted_count > 0 ? status.ok.fg : inkAlpha(0.55) }}
          >
            {run.extracted_count}
          </Box>
        </Typography>
        <Typography
          variant="metaMono"
          sx={{ fontSize: "0.875rem", color: "text.secondary", flexShrink: 0 }}
        >
          {formatWhen(run.finished_at, locale)}
        </Typography>
      </ButtonBase>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ pl: 6.375, pr: 2.75, pb: 2.5, pt: 0.5, bgcolor: scrim(0.18) }}>
          {run.error ? (
            <Typography variant="body2" color="error" sx={{ py: 1.5 }}>
              {run.error}
            </Typography>
          ) : run.track_results.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
              {t("admin.subtitleOcrRuns.noTracks")}
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))",
                gap: 1,
                pt: 1.5,
              }}
            >
              {run.track_results.map((track) => (
                <TrackCell key={track.track_index} track={track} locale={locale} />
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function TrackCell({
  track,
  locale,
}: {
  track: AdminSubtitleTrackOcrResult;
  locale: string;
}) {
  const { t } = useTranslation();
  const extracted = track.outcome === "extracted";
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.375,
        py: 1,
        minWidth: 0,
        overflow: "hidden",
        borderRadius: 1.5,
        bgcolor: whiteAlpha(0.025),
        border: `1px solid ${extracted ? status.ok.base : whiteAlpha(0.08)}`,
      }}
    >
      {extracted ? (
        <Check size={13} color={status.ok.fg} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      ) : (
        <X size={12} color={inkAlpha(0.45)} style={{ flexShrink: 0 }} />
      )}
      <Typography
        variant="body2"
        noWrap
        sx={{ fontWeight: 600, flex: "1 1 auto", minWidth: 0 }}
      >
        {languageName(track.language, locale)}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <AdminBadge tone={trackTone(track.outcome)}>
          {t(`admin.subtitleOcrRuns.trackOutcome.${track.outcome}`, {
            defaultValue: track.outcome,
          })}
        </AdminBadge>
        {extracted && (
          <Typography variant="metaMono" sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
            {t("admin.subtitleOcrRuns.cueCount", { count: track.cue_count })}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
