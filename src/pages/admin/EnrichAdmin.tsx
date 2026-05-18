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
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useAdminScanRuns, useTriggerBulkEnrich } from "../../api/hooks";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
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

  const runs = useAdminScanRuns("enrich");
  const trigger = useTriggerBulkEnrich();

  const [force, setForce] = useState(false);
  const [snack, setSnack] = useState<Snack>(null);
  const [error, setError] = useState<string | null>(null);

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
            title={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ color: "text.secondary", display: "flex" }}>
                  <Sparkles size={16} aria-hidden />
                </Box>
                <Box component="span">{t("admin.enrich.trigger.title")}</Box>
              </Stack>
            }
            subtitle={t("admin.enrich.trigger.subtitle")}
          />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ md: "center" }}
            justifyContent="space-between"
          >
            <FormControlLabel
              control={
                <Switch
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  size="small"
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
            <Box sx={{ flexShrink: 0 }}>
              <AdminButton
                variant="primary"
                icon={
                  trigger.isPending ? (
                    <CircularProgress size={12} sx={{ color: "inherit" }} />
                  ) : (
                    <Play size={14} />
                  )
                }
                onClick={() => void onTrigger()}
                disabled={trigger.isPending}
              >
                {trigger.isPending
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

        <AdminCard>
          <AdminCardHeader
            title={
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Box component="span">{t("admin.enrich.history.title")}</Box>
                {runs.data?.some((r) => r.status === "running") && (
                  <AdminBadge tone="info">
                    {t("admin.enrich.history.livePolling")}
                  </AdminBadge>
                )}
              </Stack>
            }
            subtitle={t("admin.enrich.history.subtitle")}
          />

          <ScanRunHistoryTable
            runs={runs.data}
            isLoading={runs.isLoading}
            isError={runs.isError}
            onRetry={() => void runs.refetch()}
            kind="enrich"
          />
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
                  ? "rgba(80,180,120,0.15)"
                  : "rgba(220,80,70,0.18)",
              border: "1px solid rgba(255,255,255,0.08)",
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
