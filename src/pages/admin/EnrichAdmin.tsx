import {
  Box,
  CircularProgress,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { Play, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useAdminScanRuns, useTriggerBulkEnrich } from "../../api/hooks";
import type { AdminScanRun } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  AdminTablePagination,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import {
  accentGold,
  goldAlpha,
  inkAlpha,
  toastSurfaceSx } from "../../theme/tokens";
import { formatElapsed, useElapsedSeconds } from "./components/elapsed";
import { ScanRunHistoryTable } from "./components/ScanRunHistoryTable";

type Snack = { message: string; severity: "success" | "error" } | null;

/**
 * Admin Enrich page. Trigger card carries the ``force`` toggle and
 * the Run-bulk-enrich button; history filtered to ``kind=enrich``.
 * Same auto-poll behaviour as the Scan page — refresh stays on
 * while any run is in flight, then idles down.
 */
export function EnrichAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.enrich.title"));

  const [pageSize, setPageSize] = useState(10);
  const runs = useAdminScanRuns("enrich", undefined, { pageSize });
  const trigger = useTriggerBulkEnrich();

  const [force, setForce] = useState(false);
  const [snack, setSnack] = useState<Snack>(null);
  const [error, setError] = useState<string | null>(null);

  const inflightRun: AdminScanRun | undefined = useMemo(
    () => runs.items.find((r) => r.status === "running"),
    [runs.items],
  );
  const isInflight = !!inflightRun;
  const elapsed = useElapsedSeconds(inflightRun?.started_at);
  const triggerBusy = trigger.isPending;
  const canRun = !isInflight && !triggerBusy;

  const onTrigger = async () => {
    setError(null);
    try {
      const run = await trigger.mutateAsync(force);
      setSnack({
        message: t("admin.enrich.snack.dispatched", { runId: run.id }),
        severity: "success",
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("admin.enrich.snack.failed"),
      );
    }
  };

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.enrich")]}
        title={t("admin.enrich.title")}
        subtitle={t("admin.enrich.subtitle")}
      />

      <Stack spacing={2.5}>
        <AdminCard>
          <AdminCardHeader
            icon={Sparkles}
            title={t("admin.enrich.trigger.title")}
            subtitle={
              isInflight
                ? t("admin.enrich.trigger.inflightSubtitle")
                : t("admin.enrich.trigger.subtitle")
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
                  {t("admin.enrich.trigger.running")}
                </AdminBadge>
              ) : undefined
            }
          />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems="flex-start"
            flexWrap="wrap"
          >
            <Box sx={{ flex: "1 1 360px", minWidth: 0 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    size="small"
                    disabled={isInflight}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {t("admin.enrich.trigger.forceLabel")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("admin.enrich.trigger.forceHelper")}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", m: 0 }}
              />
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
                  ? t("admin.enrich.trigger.inflightCta")
                  : triggerBusy
                    ? t("admin.enrich.trigger.submitting")
                    : t("admin.enrich.trigger.cta")}
              </AdminButton>
            </Box>
          </Stack>

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
                <Sparkles size={16} color={accentGold} aria-hidden />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: accentGold, fontWeight: 500 }}>
                  {t("admin.enrich.inflight.title")}
                </Typography>
                <Typography
                  variant="metaMono"
                  sx={{ display: "block", mt: 0.5, color: inkAlpha(0.6) }}
                >
                  {t("admin.enrich.inflight.details", {
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
            title={t("admin.enrich.history.title")}
            subtitle={t("admin.enrich.history.subtitle")}
            titleBadge={
              runs.items.some((r) => r.status === "running") ? (
                <AdminBadge tone="info">
                  {t("admin.enrich.history.livePolling")}
                </AdminBadge>
              ) : undefined
            }
          />

          <ScanRunHistoryTable
            runs={runs.items}
            isLoading={runs.isLoading}
            isError={runs.isError}
            onRetry={runs.refetch}
            kind="enrich"
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
              ...toastSurfaceSx(snack.severity),
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
