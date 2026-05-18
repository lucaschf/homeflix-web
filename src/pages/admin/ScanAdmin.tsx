import {
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { Play, ScanLine } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  useAdminScanRuns,
  useLibraries,
  useTriggerScan,
} from "../../api/hooks";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminPageHeader,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { ScanRunHistoryTable } from "./components/ScanRunHistoryTable";

type Snack = { message: string; severity: "success" | "error" } | null;

/**
 * Admin Scan page. Top card carries the trigger affordance
 * (library picker + Run scan button); the lower card lists the
 * scan history (``kind=scan``) and auto-polls while any row is
 * still ``running`` so the operator sees the live transition.
 */
export function ScanAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.scan.title"));

  const libraries = useLibraries();
  const runs = useAdminScanRuns("scan");
  const trigger = useTriggerScan();

  const [libraryId, setLibraryId] = useState<string>("");
  const [snack, setSnack] = useState<Snack>(null);
  const [error, setError] = useState<string | null>(null);

  const onTrigger = async () => {
    if (!libraryId) return;
    setError(null);
    try {
      const run = await trigger.mutateAsync(libraryId);
      setSnack({
        message: t("admin.scan.snack.dispatched", { runId: run.id }),
        severity: "success",
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.scan.snack.failed"));
    }
  };

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
            title={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ color: "text.secondary", display: "flex" }}>
                  <ScanLine size={16} aria-hidden />
                </Box>
                <Box component="span">{t("admin.scan.trigger.title")}</Box>
              </Stack>
            }
            subtitle={t("admin.scan.trigger.subtitle")}
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
            <AdminEmptyState
              icon={ScanLine}
              title={t("admin.scan.trigger.noLibrariesTitle")}
              body={t("admin.scan.trigger.noLibrariesBody")}
            />
          ) : (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "flex-end" }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="eyebrow"
                  component="label"
                  sx={{
                    display: "block",
                    color: "text.secondary",
                    letterSpacing: "0.14em",
                    fontSize: "0.625rem",
                    mb: 0.875,
                  }}
                >
                  {t("admin.scan.trigger.libraryLabel")}
                </Typography>
                <Select<string>
                  size="small"
                  fullWidth
                  value={libraryId}
                  displayEmpty
                  onChange={(e) => setLibraryId(e.target.value)}
                  sx={{
                    fontSize: "0.875rem",
                    bgcolor: "rgba(255,255,255,0.025)",
                  }}
                >
                  <MenuItem value="" disabled sx={{ fontSize: "0.875rem" }}>
                    {t("admin.scan.trigger.libraryPlaceholder")}
                  </MenuItem>
                  {libraries.data.map((lib) => (
                    <MenuItem key={lib.id} value={lib.id} sx={{ fontSize: "0.875rem" }}>
                      {lib.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
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
                  disabled={!libraryId || trigger.isPending}
                >
                  {trigger.isPending
                    ? t("admin.scan.trigger.submitting")
                    : t("admin.scan.trigger.cta")}
                </AdminButton>
              </Box>
            </Stack>
          )}

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
                <Box component="span">{t("admin.scan.history.title")}</Box>
                {runs.data?.some((r) => r.status === "running") && (
                  <AdminBadge tone="info">
                    {t("admin.scan.history.livePolling")}
                  </AdminBadge>
                )}
              </Stack>
            }
            subtitle={t("admin.scan.history.subtitle")}
          />

          <ScanRunHistoryTable
            runs={runs.data}
            isLoading={runs.isLoading}
            isError={runs.isError}
            onRetry={() => void runs.refetch()}
            kind="scan"
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
