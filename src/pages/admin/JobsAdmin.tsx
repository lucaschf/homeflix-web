import { Alert, Box, ButtonBase, Snackbar, Stack, Typography, alpha } from "@mui/material";
import {
  AlertTriangle,
  Clock,
  History,
  ListChecks,
  Play,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobRuns, useJobs, useTriggerJob } from "../../api/hooks";
import type { JobRunRecord, JobSummary } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  AdminTablePagination,
  FancyEmpty,
  StatCard,
  type BadgeTone,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { peach } from "../../theme/colors";
import { status as statusTokens, inkAlpha, whiteAlpha } from "../../theme/tokens";
import {
  formatRelativeServerTime,
  parseServerDate,
  parseServerTime,
} from "../../utils/datetime";
import { humanizeSchedule } from "../../utils/jobSchedule";

// Grid templates shared by each table's header row and its data rows so
// the columns line up exactly.
const SCHED_GRID = "minmax(200px, 1.4fr) 132px 200px 180px 44px";
const HIST_GRID = "minmax(220px, 1.5fr) 120px 84px minmax(0, 1.4fr) 168px";

// How long an optimistic "Running" badge survives after a manual
// trigger before we trust the polled state again.
const OPTIMISTIC_RUN_MS = 30_000;

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

/** Dot colour for a run outcome (``never`` = no run yet). */
function dotColor(status: string): string {
  switch (status) {
    case "succeeded":
      return statusTokens.ok.fg;
    case "failed":
      return statusTokens.err.fg;
    case "interrupted":
      return statusTokens.warn.fg;
    case "running":
      return statusTokens.info.fg;
    default:
      return whiteAlpha(0.18);
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

/** Library id carried as a ``library-scan:lib_x`` suffix, if any. */
function libraryId(jobId: string): string | null {
  const match = /^library-scan:(.+)$/.exec(jobId);
  return match ? match[1] : null;
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
 * schedule (humanized + next run), a run-health strip of recent
 * outcomes, last execution, and a "run now" trigger, plus a paginated
 * execution history and 24-hour summary tiles. Answers "is anything
 * running / did the backfill actually run / why did it fail" without
 * grepping logs.
 */
export function JobsAdmin() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  useDocumentTitle(t("admin.jobs.title"));
  const overview = useJobs();
  const [pageSize, setPageSize] = useState(10);
  const runs = useJobRuns({}, { pageSize });
  const triggerJob = useTriggerJob();

  // Optimistic per-job trigger timestamps so a freshly-triggered job
  // reads as "Running" until the poll catches up.
  const [pendingRuns, setPendingRuns] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);

  const handleRunNow = (job: JobSummary) => {
    const id = job.job_id;
    setPendingRuns((prev) => ({ ...prev, [id]: Date.now() }));
    triggerJob.mutate(id, {
      onSuccess: () => {
        setToast({
          severity: "success",
          message: t("admin.jobs.runNowSuccess", { job: jobLabel(id) }),
        });
      },
      onError: () => {
        setPendingRuns((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setToast({
          severity: "error",
          message: t("admin.jobs.runNowError", { job: jobLabel(id) }),
        });
      },
    });
  };

  const refresh = () => {
    overview.refetch();
    runs.refetch();
  };

  const jobs = overview.data?.jobs ?? [];
  const neverRan = jobs.filter((j) => !j.last_run).length;
  const executions = overview.data?.executions_24h ?? 0;
  const failures = overview.data?.failures_24h ?? 0;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.system"), t("admin.nav.jobs")]}
        title={t("admin.jobs.title")}
        subtitle={t("admin.jobs.subtitle")}
        primaryCTA={
          <AdminButton
            variant="primary"
            icon={<RefreshCw size={14} />}
            onClick={refresh}
            disabled={overview.isFetching || runs.isFetching}
          >
            {t("admin.jobs.refresh")}
          </AdminButton>
        }
      />

      {/* Summary strip */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          gap: 1.75,
          mb: 3.5,
        }}
      >
        <SchedulerCard running={overview.data?.scheduler_running ?? false} />
        <StatCard
          label={t("admin.jobs.summary.jobs")}
          value={jobs.length}
          icon={ListChecks}
          sub={t("admin.jobs.summary.neverRan", { count: neverRan })}
          loading={overview.isLoading}
        />
        <StatCard
          label={t("admin.jobs.summary.executions")}
          value={executions}
          icon={History}
          sub={t("admin.jobs.summary.executionsSub")}
          loading={overview.isLoading}
        />
        <StatCard
          label={t("admin.jobs.summary.failures")}
          value={failures}
          icon={AlertTriangle}
          alert={failures > 0}
          sub={
            failures > 0
              ? t("admin.jobs.summary.failuresPresent", { count: failures })
              : t("admin.jobs.summary.failuresClean")
          }
          loading={overview.isLoading}
        />
      </Box>

      {/* Scheduled jobs */}
      <AdminCard padding={0} sx={{ overflow: "hidden", mb: 3.5 }}>
        <Box sx={{ p: "18px 20px 16px", borderBottom: `1px solid ${whiteAlpha(0.08)}` }}>
          <AdminCardHeader
            icon={ListChecks}
            title={t("admin.jobs.overview.title")}
            subtitle={t("admin.jobs.overview.subtitle")}
          />
        </Box>
        {overview.isLoading ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
            {t("admin.jobs.loading")}
          </Typography>
        ) : overview.isError ? (
          <Typography variant="body2" color="error" sx={{ p: 2.5 }}>
            {t("admin.jobs.error")}
          </Typography>
        ) : jobs.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <FancyEmpty icon={ListChecks} motif="rows" title={t("admin.jobs.empty")} />
          </Box>
        ) : (
          <>
            <ScheduledHeader t={t} />
            {jobs.map((job, i) => (
              <JobRow
                key={job.job_id}
                job={job}
                locale={locale}
                t={t}
                isLast={i === jobs.length - 1}
                optimisticRunning={isOptimisticallyRunning(job, pendingRuns[job.job_id])}
                onRunNow={() => handleRunNow(job)}
              />
            ))}
          </>
        )}
      </AdminCard>

      {/* Run history */}
      <AdminCard padding={0} sx={{ overflow: "hidden" }}>
        <Box sx={{ p: "18px 20px 16px", borderBottom: `1px solid ${whiteAlpha(0.08)}` }}>
          <AdminCardHeader
            icon={History}
            title={t("admin.jobs.history.title")}
            subtitle={t("admin.jobs.history.subtitle")}
          />
        </Box>
        {runs.isLoading ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
            {t("admin.jobs.loading")}
          </Typography>
        ) : runs.isError ? (
          <Typography variant="body2" color="error" sx={{ p: 2.5 }}>
            {t("admin.jobs.error")}
          </Typography>
        ) : runs.items.length === 0 && !runs.canGoPrevious ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
            {t("admin.jobs.history.empty")}
          </Typography>
        ) : (
          <>
            <HistoryHeader t={t} />
            {runs.items.map((run, i) => (
              <RunRow
                key={run.id}
                run={run}
                locale={locale}
                t={t}
                isLast={i === runs.items.length - 1}
              />
            ))}
            <Box sx={{ borderTop: `1px solid ${whiteAlpha(0.08)}`, px: 1 }}>
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
            </Box>
          </>
        )}
      </AdminCard>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}

/** Whether a manual trigger should still force the Running badge. */
function isOptimisticallyRunning(job: JobSummary, triggeredAt: number | undefined): boolean {
  if (triggeredAt == null) return false;
  if (Date.now() - triggeredAt > OPTIMISTIC_RUN_MS) return false;
  // A terminal run that started after we triggered means the manual run
  // already finished — drop the optimistic badge.
  if (
    job.last_run &&
    job.last_run.status !== "running" &&
    parseServerTime(job.last_run.started_at) >= triggeredAt
  ) {
    return false;
  }
  return true;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

const HEADER_CELL = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: "0.625rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "text.secondary",
  fontWeight: 500,
};

function ScheduledHeader({ t }: { t: TFn }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: SCHED_GRID,
        gap: 2,
        px: "20px",
        py: "11px",
        borderBottom: `1px solid ${whiteAlpha(0.08)}`,
        bgcolor: whiteAlpha(0.02),
      }}
    >
      <Typography sx={HEADER_CELL}>{t("admin.jobs.cols.job")}</Typography>
      <Typography sx={HEADER_CELL}>{t("admin.jobs.cols.history")}</Typography>
      <Typography sx={HEADER_CELL}>{t("admin.jobs.cols.lastRun")}</Typography>
      <Typography sx={{ ...HEADER_CELL, textAlign: "right" }}>
        {t("admin.jobs.cols.next")}
      </Typography>
      <span />
    </Box>
  );
}

function HistoryHeader({ t }: { t: TFn }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: HIST_GRID,
        gap: 2,
        px: "20px",
        py: "11px",
        borderBottom: `1px solid ${whiteAlpha(0.08)}`,
        bgcolor: whiteAlpha(0.02),
      }}
    >
      <Typography sx={HEADER_CELL}>{t("admin.jobs.history.cols.job")}</Typography>
      <Typography sx={HEADER_CELL}>{t("admin.jobs.history.cols.status")}</Typography>
      <Typography sx={HEADER_CELL}>{t("admin.jobs.history.cols.duration")}</Typography>
      <Typography sx={HEADER_CELL}>{t("admin.jobs.history.cols.detail")}</Typography>
      <Typography sx={{ ...HEADER_CELL, textAlign: "right" }}>
        {t("admin.jobs.history.cols.when")}
      </Typography>
    </Box>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = dotColor(status);
  return (
    <Box
      component="span"
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: color,
        boxShadow: status === "never" ? "none" : `0 0 8px ${alpha(color, 0.4)}`,
      }}
    />
  );
}

/** Recent outcomes as a row of coloured ticks (newest strongest). */
function RunStrip({ runs, t }: { runs: string[]; t: TFn }) {
  if (!runs.length) {
    return (
      <Typography variant="metaMono" sx={{ color: inkAlpha(0.25) }}>
        {t("admin.jobs.strip.empty")}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "3px" }}>
      {runs.map((r, i) => (
        <Box
          key={i}
          sx={{
            width: 4,
            height: 16,
            borderRadius: "2px",
            bgcolor: dotColor(r),
            opacity: r === "succeeded" ? 0.55 + (i / runs.length) * 0.45 : 1,
          }}
        />
      ))}
    </Box>
  );
}

const ROW_SX = {
  alignItems: "center",
  gap: 2,
  px: "20px",
  transition: "background-color 110ms ease",
  "&:hover": { bgcolor: whiteAlpha(0.022) },
} as const;

function JobRow({
  job,
  locale,
  t,
  isLast,
  optimisticRunning,
  onRunNow,
}: {
  job: JobSummary;
  locale: string;
  t: TFn;
  isLast: boolean;
  optimisticRunning: boolean;
  onRunNow: () => void;
}) {
  const last = job.last_run;
  const running = job.running || optimisticRunning;
  const dotStatus = running ? "running" : (last?.status ?? "never");
  const lib = libraryId(job.job_id);
  const nextRel = formatRelativeServerTime(job.next_run_at, locale);
  const lastRel = last ? formatRelativeServerTime(last.started_at, locale) : null;

  return (
    <Box
      sx={{
        ...ROW_SX,
        display: "grid",
        gridTemplateColumns: SCHED_GRID,
        py: "14px",
        borderBottom: isLast ? "none" : `1px solid ${whiteAlpha(0.08)}`,
      }}
    >
      {/* Job + schedule */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <StatusDot status={dotStatus} />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {jobLabel(job.job_id)}
            </Typography>
            {lib && (
              <Typography variant="metaMono" sx={{ color: inkAlpha(0.5) }} noWrap>
                {lib}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: inkAlpha(0.6), display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <RefreshCw size={11} />
              {job.scheduled ? humanizeSchedule(job.schedule, t) : t("admin.jobs.notScheduled")}
            </Typography>
            {job.schedule && (
              <Typography
                variant="metaMono"
                title={job.schedule}
                sx={{
                  fontSize: "0.5938rem",
                  color: inkAlpha(0.28),
                  border: `1px solid ${whiteAlpha(0.08)}`,
                  borderRadius: "4px",
                  px: "5px",
                  py: "1px",
                  cursor: "help",
                }}
                noWrap
              >
                {job.schedule}
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Run strip */}
      <RunStrip runs={job.recent_runs} t={t} />

      {/* Last run */}
      <Box sx={{ minWidth: 0 }}>
        {running ? (
          <AdminBadge tone="info">{t("admin.jobs.running")}</AdminBadge>
        ) : last ? (
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <AdminBadge tone={statusTone(last.status)}>
              {t(`admin.jobs.status.${last.status}`, { defaultValue: last.status })}
            </AdminBadge>
            <Typography variant="metaMono" sx={{ color: inkAlpha(0.85) }}>
              {formatDuration(last.duration_ms)}
            </Typography>
          </Stack>
        ) : (
          <AdminBadge tone="neutral">{t("admin.jobs.neverRan")}</AdminBadge>
        )}
        {last && !running && lastRel && (
          <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
            {lastRel} · {formatWhen(last.started_at, locale)}
          </Typography>
        )}
      </Box>

      {/* Next run */}
      <Box sx={{ textAlign: "right" }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.75,
          }}
        >
          <Clock size={12} color={peach.main} />
          {job.next_run_at && nextRel ? nextRel : t("admin.jobs.noNextRun")}
        </Typography>
        {job.next_run_at && (
          <Typography variant="metaMono" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
            {formatWhen(job.next_run_at, locale)}
          </Typography>
        )}
      </Box>

      {/* Run now */}
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        {job.scheduled && (
          <ButtonBase
            onClick={onRunNow}
            disabled={running}
            focusRipple
            title={t("admin.jobs.runNow")}
            aria-label={t("admin.jobs.runNow")}
            sx={{
              width: 30,
              height: 30,
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "transparent",
              border: "1px solid transparent",
              color: "text.secondary",
              opacity: running ? 0.4 : 1,
              transition: "all 120ms ease",
              "&:hover:not(.Mui-disabled)": {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
                color: "primary.main",
              },
            }}
          >
            <Play size={13} />
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
}

function RunRow({
  run,
  locale,
  t,
  isLast,
}: {
  run: JobRunRecord;
  locale: string;
  t: TFn;
  isLast: boolean;
}) {
  const lib = libraryId(run.job_id);
  const rel = formatRelativeServerTime(run.started_at, locale);
  return (
    <Box
      sx={{
        ...ROW_SX,
        display: "grid",
        gridTemplateColumns: HIST_GRID,
        py: "12px",
        borderBottom: isLast ? "none" : `1px solid ${whiteAlpha(0.08)}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <StatusDot status={run.status} />
        <Typography variant="body2" noWrap>
          {jobLabel(run.job_id)}
        </Typography>
        {lib && (
          <Typography variant="metaMono" sx={{ color: inkAlpha(0.45) }} noWrap>
            {lib}
          </Typography>
        )}
      </Box>
      <Box>
        <AdminBadge tone={statusTone(run.status)}>
          {t(`admin.jobs.status.${run.status}`, { defaultValue: run.status })}
        </AdminBadge>
      </Box>
      <Typography variant="metaMono" sx={{ color: inkAlpha(0.8) }}>
        {formatDuration(run.duration_ms)}
      </Typography>
      <Typography variant="body2" sx={{ color: statusTokens.err.fg }} noWrap>
        {run.error ?? ""}
      </Typography>
      <Box sx={{ textAlign: "right" }}>
        {rel && (
          <Typography variant="body2" sx={{ color: inkAlpha(0.7) }}>
            {rel}
          </Typography>
        )}
        <Typography variant="metaMono" sx={{ color: "text.secondary", mt: 0.25, display: "block" }}>
          {formatWhen(run.started_at, locale)}
        </Typography>
      </Box>
    </Box>
  );
}

/** Scheduler health tile — green accent + live pulse when running. */
function SchedulerCard({ running }: { running: boolean }) {
  const { t } = useTranslation();
  const accent = running ? statusTokens.ok.fg : statusTokens.warn.fg;
  return (
    <Box
      sx={{
        bgcolor: running ? alpha(statusTokens.ok.base, 0.04) : whiteAlpha(0.025),
        border: `1px solid ${running ? alpha(statusTokens.ok.base, 0.28) : whiteAlpha(0.08)}`,
        borderRadius: "8px",
        py: 3,
        px: 3,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography
          variant="eyebrow"
          sx={{ color: "text.secondary", letterSpacing: "0.16em", fontSize: "0.625rem" }}
        >
          {t("admin.jobs.summary.scheduler")}
        </Typography>
        {running && (
          <Box sx={{ position: "relative", width: 8, height: 8 }}>
            <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", bgcolor: accent }} />
            <Box
              sx={{
                position: "absolute",
                inset: "-3px",
                borderRadius: "50%",
                border: `1px solid ${alpha(accent, 0.5)}`,
                animation: "hf-job-pulse 2.4s ease-out infinite",
                "@keyframes hf-job-pulse": {
                  "0%": { transform: "scale(1)", opacity: 0.7 },
                  "100%": { transform: "scale(2.4)", opacity: 0 },
                },
              }}
            />
          </Box>
        )}
      </Box>
      <Typography variant="statValue" sx={{ color: accent }}>
        {running ? t("admin.jobs.summary.running") : t("admin.jobs.summary.stopped")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontSize: "0.78125rem" }}>
        {running ? t("admin.jobs.summary.tick") : t("admin.jobs.summary.idle")}
      </Typography>
    </Box>
  );
}
