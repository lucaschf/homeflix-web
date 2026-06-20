import { Box, Stack, Typography } from "@mui/material";
import { CircleDot, Clock, History, ListChecks } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobRuns, useJobs } from "../../api/hooks";
import type { JobRunRecord, JobSummary } from "../../api/types";
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
import { parseServerDate } from "../../utils/datetime";

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "succeeded":
      return "ok";
    case "failed":
      return "err";
    case "interrupted":
      return "warn";
    case "running":
      return "info";
    default:
      return "neutral";
  }
}

/** Turn ``homeflix:thumbnail-backfill`` into "Thumbnail backfill". */
function jobLabel(jobId: string): string {
  const cleaned = jobId.replace(/^homeflix:/, "");
  const [kind, suffix] = cleaned.split(/:(.+)/);
  const pretty = kind.replace(/[-_]/g, " ");
  const titled = pretty.charAt(0).toUpperCase() + pretty.slice(1);
  return suffix ? `${titled}: ${suffix}` : titled;
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

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/**
 * Admin Jobs dashboard — every background scheduler job with its live
 * schedule (next run), last execution (status + duration), and a
 * "running now" indicator, plus a paginated execution history. Answers
 * "is anything running / did the backfill actually run / why did it
 * fail" without grepping logs.
 */
export function JobsAdmin() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("admin.jobs.title"));
  const overview = useJobs();
  const [pageSize, setPageSize] = useState(10);
  const runs = useJobRuns({}, { pageSize });

  const schedulerBadge = overview.data ? (
    <AdminBadge tone={overview.data.scheduler_running ? "ok" : "neutral"}>
      {overview.data.scheduler_running
        ? t("admin.jobs.schedulerRunning")
        : t("admin.jobs.schedulerStopped")}
    </AdminBadge>
  ) : undefined;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.system"), t("admin.nav.jobs")]}
        title={t("admin.jobs.title")}
        subtitle={t("admin.jobs.subtitle")}
        toolbar={schedulerBadge}
      />

      <AdminCard>
        <AdminCardHeader
          icon={ListChecks}
          title={t("admin.jobs.overview.title")}
          subtitle={t("admin.jobs.overview.subtitle")}
        />
        {overview.isLoading ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {t("admin.jobs.loading")}
          </Typography>
        ) : overview.isError ? (
          <Typography variant="body2" color="error" sx={{ py: 2 }}>
            {t("admin.jobs.error")}
          </Typography>
        ) : !overview.data || overview.data.jobs.length === 0 ? (
          <FancyEmpty icon={ListChecks} motif="rows" title={t("admin.jobs.empty")} />
        ) : (
          <Stack spacing={0.5}>
            {overview.data.jobs.map((job) => (
              <JobRow key={job.job_id} job={job} locale={i18n.language} />
            ))}
          </Stack>
        )}
      </AdminCard>

      <Box sx={{ mt: 2 }}>
        <AdminCard>
          <AdminCardHeader
            icon={History}
            title={t("admin.jobs.history.title")}
            subtitle={t("admin.jobs.history.subtitle")}
          />
          {runs.isLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t("admin.jobs.loading")}
            </Typography>
          ) : runs.isError ? (
            <Typography variant="body2" color="error" sx={{ py: 2 }}>
              {t("admin.jobs.error")}
            </Typography>
          ) : runs.items.length === 0 && !runs.canGoPrevious ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t("admin.jobs.history.empty")}
            </Typography>
          ) : (
            <>
              <Stack spacing={0.5}>
                {runs.items.map((run) => (
                  <RunRow key={run.id} run={run} locale={i18n.language} />
                ))}
              </Stack>
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
            </>
          )}
        </AdminCard>
      </Box>
    </>
  );
}

function JobRow({ job, locale }: { job: JobSummary; locale: string }) {
  const { t } = useTranslation();
  const last = job.last_run;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
      }}
    >
      <Stack sx={{ minWidth: 160, flexShrink: 1, gap: 0.1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {jobLabel(job.job_id)}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {job.scheduled ? job.schedule : t("admin.jobs.notScheduled")}
        </Typography>
      </Stack>

      {job.running ? (
        <AdminBadge tone="info">
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <CircleDot size={12} />
            {t("admin.jobs.running")}
          </Box>
        </AdminBadge>
      ) : last ? (
        <AdminBadge tone={statusTone(last.status)}>
          {t(`admin.jobs.status.${last.status}`, { defaultValue: last.status })}
        </AdminBadge>
      ) : (
        <AdminBadge tone="neutral">{t("admin.jobs.neverRan")}</AdminBadge>
      )}

      <Typography variant="metaMono" sx={{ color: inkAlpha(0.7), minWidth: 64 }}>
        {last ? formatDuration(last.duration_ms) : "—"}
      </Typography>

      <Stack sx={{ ml: "auto", textAlign: "right", gap: 0.1 }}>
        <Typography
          variant="metaMono"
          sx={{ color: "text.secondary", display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          <Clock size={12} />
          {job.next_run_at
            ? t("admin.jobs.nextRun", { when: formatWhen(job.next_run_at, locale) })
            : t("admin.jobs.noNextRun")}
        </Typography>
        {last && (
          <Typography variant="metaMono" sx={{ color: inkAlpha(0.55) }}>
            {t("admin.jobs.lastRun", { when: formatWhen(last.started_at, locale) })}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function RunRow({ run, locale }: { run: JobRunRecord; locale: string }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1,
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
      }}
    >
      <Typography variant="body2" sx={{ minWidth: 160, fontWeight: 500 }} noWrap>
        {jobLabel(run.job_id)}
      </Typography>
      <AdminBadge tone={statusTone(run.status)}>
        {t(`admin.jobs.status.${run.status}`, { defaultValue: run.status })}
      </AdminBadge>
      <Typography variant="metaMono" sx={{ color: inkAlpha(0.7), minWidth: 64 }}>
        {formatDuration(run.duration_ms)}
      </Typography>
      {run.error && (
        <Typography variant="metaMono" color="error" noWrap sx={{ flexShrink: 1, minWidth: 0 }}>
          {run.error}
        </Typography>
      )}
      <Typography variant="metaMono" sx={{ color: "text.secondary", ml: "auto" }}>
        {formatWhen(run.started_at, locale)}
      </Typography>
    </Box>
  );
}
