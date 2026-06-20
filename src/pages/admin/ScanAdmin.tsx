import {
  Box,
  CircularProgress,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { Check, Play, ScanLine } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  useAdminScanRuns,
  useLibraries,
  useTriggerScan,
} from "../../api/hooks";
import type { AdminScanRun, Library } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  AdminTablePagination,
  FancyEmpty,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { peach } from "../../theme/colors";
import {
  accentGold,
  goldAlpha,
  inkAlpha,
  peachAlpha,
  status,
  whiteAlpha,
} from "../../theme/tokens";
import { alpha } from "@mui/material/styles";
import { formatElapsed, useElapsedSeconds } from "./components/elapsed";
import { ScanRunHistoryTable } from "./components/ScanRunHistoryTable";

type Snack = { message: string; severity: "success" | "error" } | null;

const PEACH = peach.main;

// Parse a single cron field into a predicate keyed on the
// numeric value. Handles ``*``, ``5``, ``0-30``, "*/5" (every N)
// and ``1,3,5`` (lists). Returns ``null`` when the field is
// unparseable so the caller can skip the whole expression
// instead of pretending it matched.
function parseCronField(
  field: string,
  min: number,
  max: number,
): ((v: number) => boolean) | null {
  if (field === "*") return () => true;
  const allowed = new Set<number>();
  for (const part of field.split(",")) {
    let range = part;
    let step = 1;
    const stepIdx = part.indexOf("/");
    if (stepIdx >= 0) {
      step = Number(part.slice(stepIdx + 1));
      range = part.slice(0, stepIdx);
      if (!Number.isFinite(step) || step <= 0) return null;
    }
    let lo: number;
    let hi: number;
    if (range === "*") {
      lo = min;
      hi = max;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      lo = a;
      hi = b;
    } else {
      const n = Number(range);
      if (!Number.isFinite(n)) return null;
      lo = n;
      hi = n;
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) allowed.add(v);
  }
  return (v) => allowed.has(v);
}

/**
 * Compute the next fire time of a cron expression by walking
 * minute-by-minute from ``from + 1min``. Caps lookahead at 60
 * days so a pathological "once a year" entry can't hang the
 * render loop. Returns ``null`` for unparseable expressions.
 *
 * The grammar covered is standard 5-field cron
 * (``min hour day month dow``). ``dow`` ``7`` is treated as
 * Sunday (matches ``cron`` POSIX convention).
 */
function nextFromCron(cron: string, from: Date = new Date()): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const matchMin = parseCronField(parts[0], 0, 59);
  const matchHour = parseCronField(parts[1], 0, 23);
  const matchDom = parseCronField(parts[2], 1, 31);
  const matchMonth = parseCronField(parts[3], 1, 12);
  const matchDow = parseCronField(parts[4], 0, 7);
  if (!matchMin || !matchHour || !matchDom || !matchMonth || !matchDow) {
    return null;
  }

  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const MAX_ITERS = 60 * 24 * 60; // 60 days of minutes
  for (let i = 0; i < MAX_ITERS; i += 1) {
    const m = cursor.getMinutes();
    const h = cursor.getHours();
    const dom = cursor.getDate();
    const month = cursor.getMonth() + 1;
    // ``getDay`` returns 0-6 (Sun-Sat); cron's dow accepts 0 or 7
    // for Sunday so we normalise to 0 and let ``matchDow`` decide.
    const dow = cursor.getDay();
    if (
      matchMin(m) &&
      matchHour(h) &&
      matchMonth(month) &&
      matchDom(dom) &&
      (matchDow(dow) || (dow === 0 && matchDow(7)))
    ) {
      return new Date(cursor);
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

/**
 * Earliest next-fire timestamp across every scheduled library.
 * Returns ``null`` when no library has a schedule or every cron
 * expression is unparseable.
 */
function nextScheduledAcross(libraries: Library[]): Date | null {
  let earliest: Date | null = null;
  for (const lib of libraries) {
    if (!lib.scan_schedule) continue;
    const next = nextFromCron(lib.scan_schedule);
    if (next && (earliest === null || next < earliest)) earliest = next;
  }
  return earliest;
}

function formatRelative(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const minutes = Math.round(diffMs / 60_000);
  const hours = Math.round(diffMs / 3_600_000);

  // Anything inside the next minute: just show the wall-clock time.
  if (Math.abs(diffMs) < 60_000) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  if (Math.abs(minutes) < 60) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return rtf.format(minutes, "minute");
  }

  // Within 24h: show absolute time (e.g. "today 14:00" or just "14:00").
  if (Math.abs(hours) < 24) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  // Beyond 24h: day-of-week + time.
  return date.toLocaleString(locale, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Admin Scan page — chip-based multi-select of libraries + "scan
 * all" toggle, primary Run-scan-now CTA with the next scheduled
 * fire time below it, an in-flight banner while at least one row
 * is ``running``, and the shared history table at the bottom.
 *
 * The trigger fires one ``POST /api/v1/admin/scans`` per selected
 * library in parallel — the backend's endpoint is per-library
 * today, so the fan-out happens client-side and the history table
 * picks up one row per library.
 */
export function ScanAdmin() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("admin.scan.title"));

  const libraries = useLibraries();
  const [pageSize, setPageSize] = useState(10);
  const runs = useAdminScanRuns("scan", undefined, { pageSize });
  const trigger = useTriggerScan();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanAll, setScanAll] = useState(false);
  const [snack, setSnack] = useState<Snack>(null);
  const [error, setError] = useState<string | null>(null);

  const inflightRun: AdminScanRun | undefined = useMemo(
    () => runs.items.find((r) => r.status === "running"),
    [runs.items],
  );
  const isInflight = !!inflightRun;
  const elapsed = useElapsedSeconds(inflightRun?.started_at);

  const nextRun = useMemo(
    () => (libraries.data ? nextScheduledAcross(libraries.data) : null),
    [libraries.data],
  );

  const libsToScan = useMemo<Library[]>(() => {
    if (!libraries.data) return [];
    if (scanAll) return libraries.data;
    return libraries.data.filter((l) => selectedIds.includes(l.id));
  }, [libraries.data, scanAll, selectedIds]);

  const toggleLibrary = (libraryId: string) => {
    if (isInflight || scanAll) return;
    setSelectedIds((prev) =>
      prev.includes(libraryId)
        ? prev.filter((id) => id !== libraryId)
        : [...prev, libraryId],
    );
  };

  const onTrigger = async () => {
    if (libsToScan.length === 0) return;
    setError(null);
    try {
      const results = await Promise.all(
        libsToScan.map((lib) => trigger.mutateAsync(lib.id)),
      );
      setSnack({
        message:
          results.length === 1
            ? t("admin.scan.snack.dispatched", { runId: results[0].id })
            : t("admin.scan.snack.dispatchedMany", { count: results.length }),
        severity: "success",
      });
      // Clear selection after a successful dispatch so the user
      // doesn't accidentally fire the same set again on a stray
      // click.
      setSelectedIds([]);
      setScanAll(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.scan.snack.failed"));
    }
  };

  const triggerBusy = trigger.isPending;
  const canRun = libsToScan.length > 0 && !isInflight && !triggerBusy;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.scan")]}
        title={t("admin.scan.title")}
        subtitle={t("admin.scan.subtitle")}
      />

      <Stack spacing={2.5}>
        <AdminCard>
          <AdminCardHeader
            icon={ScanLine}
            title={t("admin.scan.trigger.title")}
            subtitle={
              isInflight
                ? t("admin.scan.trigger.inflightSubtitle")
                : t("admin.scan.trigger.subtitle")
            }
            action={
              isInflight ? (
                <AdminBadge tone="warn">
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: accentGold,
                      mr: 0.75,
                      display: "inline-block",
                    }}
                  />
                  {t("admin.scan.trigger.running")}
                </AdminBadge>
              ) : undefined
            }
          />

          {libraries.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={20} color="primary" />
            </Box>
          ) : libraries.isError || !libraries.data ? (
            <Typography variant="body2" color="error">
              {t("admin.scan.trigger.librariesError")}
            </Typography>
          ) : libraries.data.length === 0 ? (
            <FancyEmpty
              icon={ScanLine}
              motif="orbit"
              framed={false}
              title={t("admin.scan.trigger.noLibrariesTitle")}
              body={t("admin.scan.trigger.noLibrariesBody")}
            />
          ) : (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              alignItems="flex-start"
              flexWrap="wrap"
            >
              <Box sx={{ flex: "1 1 360px", minWidth: 0 }}>
                <Typography
                  variant="eyebrow"
                  component="div"
                  sx={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: "0.625rem",
                    letterSpacing: "0.14em",
                    color: "text.secondary",
                    mb: 1.25,
                  }}
                >
                  {t("admin.scan.trigger.libraryLabel")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {libraries.data.map((lib) => {
                    const active = scanAll || selectedIds.includes(lib.id);
                    const disabled = isInflight || scanAll;
                    return (
                      <Box
                        key={lib.id}
                        component="button"
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleLibrary(lib.id)}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                          py: 0.75,
                          px: 1.5,
                          bgcolor: active
                            ? peachAlpha(0.12)
                            : whiteAlpha(0.03),
                          border: "1px solid",
                          borderColor: active
                            ? peachAlpha(0.35)
                            : whiteAlpha(0.08),
                          color: active ? PEACH : inkAlpha(0.7),
                          fontFamily: "inherit",
                          fontSize: "0.78125rem",
                          fontWeight: 500,
                          borderRadius: 999,
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: isInflight ? 0.5 : 1,
                          transition:
                            "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
                          "&:hover:not(:disabled)": {
                            bgcolor: active
                              ? peachAlpha(0.18)
                              : whiteAlpha(0.06),
                          },
                        }}
                      >
                        {active && <Check size={12} aria-hidden />}
                        {lib.name}
                      </Box>
                    );
                  })}
                </Box>

                <Box
                  component="label"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1.25,
                    mt: 2.25,
                    fontSize: "0.8125rem",
                    color: inkAlpha(0.75),
                    cursor: isInflight ? "not-allowed" : "pointer",
                    userSelect: "none",
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: 0.375,
                      border: "1px solid",
                      borderColor: scanAll ? PEACH : whiteAlpha(0.25),
                      bgcolor: scanAll ? PEACH : "transparent",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "background-color 140ms ease, border-color 140ms ease",
                    }}
                  >
                    {scanAll && <Check size={10} color="#0A0A0A" aria-hidden />}
                  </Box>
                  <Box
                    component="input"
                    type="checkbox"
                    checked={scanAll}
                    disabled={isInflight}
                    onChange={(e) => setScanAll(e.target.checked)}
                    sx={{ display: "none" }}
                  />
                  {t("admin.scan.trigger.scanAll")}
                </Box>
              </Box>

              <Box
                sx={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.25,
                  minWidth: 200,
                }}
              >
                <AdminButton
                  variant="primary"
                  icon={
                    triggerBusy ? (
                      <CircularProgress size={12} sx={{ color: "inherit" }} />
                    ) : (
                      <Play size={14} />
                    )
                  }
                  onClick={() => void onTrigger()}
                  disabled={!canRun}
                >
                  {isInflight
                    ? t("admin.scan.trigger.inflightCta")
                    : triggerBusy
                      ? t("admin.scan.trigger.submitting")
                      : t("admin.scan.trigger.cta")}
                </AdminButton>
                <Typography
                  variant="metaMono"
                  sx={{ color: "text.secondary", textAlign: "center" }}
                >
                  {nextRun
                    ? t("admin.scan.trigger.nextScheduled", {
                        when: formatRelative(nextRun, i18n.language),
                      })
                    : t("admin.scan.trigger.nextScheduledNone")}
                </Typography>
              </Box>
            </Stack>
          )}

          {error && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </AdminCard>

        {isInflight && inflightRun && (
          <AdminCard
            sx={{
              borderColor: goldAlpha(0.30),
              bgcolor: goldAlpha(0.04),
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: goldAlpha(0.10),
                  border: `1px solid ${goldAlpha(0.30)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  animation: "homeflix-spin 1.6s linear infinite",
                  "@keyframes homeflix-spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              >
                <ScanLine size={16} color={accentGold} aria-hidden />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: accentGold, fontWeight: 500 }}>
                  {t("admin.scan.inflight.title")}
                </Typography>
                <Typography
                  variant="metaMono"
                  sx={{ display: "block", mt: 0.5, color: inkAlpha(0.6) }}
                >
                  {t("admin.scan.inflight.details", {
                    elapsed: formatElapsed(elapsed),
                    runId: inflightRun.id,
                  })}
                </Typography>
              </Box>
            </Stack>
          </AdminCard>
        )}

        <AdminCard>
          <AdminCardHeader
            title={t("admin.scan.history.title")}
            subtitle={t("admin.scan.history.subtitle")}
          />

          <ScanRunHistoryTable
            runs={runs.items}
            isLoading={runs.isLoading}
            isError={runs.isError}
            onRetry={runs.refetch}
            kind="scan"
          />

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
      </Stack>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Box
            sx={{
              bgcolor:
                snack.severity === "success"
                  ? alpha(status.ok.base, 0.15)
                  : alpha(status.err.base, 0.18),
              border: `1px solid ${whiteAlpha(0.08)}`,
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
          >
            {snack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}
