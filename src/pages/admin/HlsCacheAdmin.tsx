import { Box, CircularProgress, LinearProgress, Snackbar, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { HardDrive, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useClearHlsCacheGlobal, useHlsCacheStats } from "../../api/hooks";
import type { HlsCacheStats } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminConfirmDialog,
  AdminPageHeader,
  type BadgeTone,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { accentCoral, status, whiteAlpha } from "../../theme/tokens";
import { parseServerDate } from "../../utils/datetime";

type Snack = { message: string; severity: "success" | "error" } | null;

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

/**
 * Map cache occupancy ratio to a status pill tone. ``warn`` past
 * 75 % gives the operator a heads-up before the evictor starts
 * dropping buckets; ``err`` past 95 % flags that the next ffmpeg
 * write will trigger an eviction round.
 */
function toneForOccupancy(ratio: number): BadgeTone {
  if (ratio >= 0.95) return "err";
  if (ratio >= 0.75) return "warn";
  return "ok";
}

function OccupancyCard({ stats }: { stats: HlsCacheStats }) {
  const { t } = useTranslation();
  const ratio = stats.max_bytes > 0 ? Math.min(stats.size_bytes / stats.max_bytes, 1) : 0;
  const percent = Math.round(ratio * 100);
  const tone = toneForOccupancy(ratio);
  const lastCleared = stats.last_cleared_at
    ? parseServerDate(stats.last_cleared_at).toLocaleString()
    : null;

  return (
    <AdminCard>
      <AdminCardHeader
        icon={HardDrive}
        title={t("admin.system.hls.occupancy.title")}
        subtitle={t("admin.system.hls.occupancy.subtitle")}
        action={
          <AdminBadge tone={tone}>
            {t("admin.system.hls.occupancy.percent", { percent })}
          </AdminBadge>
        }
      />

      <Stack spacing={2}>
        <Box>
          <LinearProgress
            variant="determinate"
            value={percent}
            sx={{
              height: 8,
              borderRadius: 999,
              backgroundColor: whiteAlpha(0.06),
              "& .MuiLinearProgress-bar": {
                borderRadius: 999,
                backgroundColor:
                  tone === "err"
                    ? accentCoral
                    : tone === "warn"
                      ? status.warn.fg
                      : status.ok.fg,
              },
            }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
            <Typography variant="metaMono" color="text.secondary">
              {formatBytes(stats.size_bytes)}
            </Typography>
            <Typography variant="metaMono" color="text.secondary">
              {t("admin.system.hls.occupancy.cap", { cap: formatBytes(stats.max_bytes) })}
            </Typography>
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
            gap: 1.5,
          }}
        >
          <StatBlock
            label={t("admin.system.hls.occupancy.usedLabel")}
            value={formatBytes(stats.size_bytes)}
          />
          <StatBlock
            label={t("admin.system.hls.occupancy.lastClearedLabel")}
            value={lastCleared ?? t("admin.system.hls.occupancy.lastClearedNever")}
            muted={!lastCleared}
          />
        </Box>
      </Stack>
    </AdminCard>
  );
}

function StatBlock({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Box
      sx={{
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
        bgcolor: whiteAlpha(0.015),
        px: 1.5,
        py: 1.25,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.6875rem" }}
      >
        {label}
      </Typography>
      <Typography
        variant="metaMono"
        sx={{ mt: 0.5, color: muted ? "text.disabled" : "text.primary" }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function HlsCacheAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.system.hls.title"));

  const { data, isLoading, isError, refetch } = useHlsCacheStats();
  const clear = useClearHlsCacheGlobal();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  const onConfirmClear = async () => {
    setClearError(null);
    try {
      await clear.mutateAsync();
      setSnack({
        message: t("admin.system.hls.snack.clearSuccess"),
        severity: "success",
      });
      setConfirmOpen(false);
    } catch (err) {
      setClearError(
        err instanceof ApiError ? err.message : t("admin.system.hls.snack.clearFailed"),
      );
    }
  };

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.system"), t("admin.nav.hls")]}
        title={t("admin.system.hls.title")}
        subtitle={t("admin.system.hls.subtitle")}
        primaryCTA={
          data ? (
            <AdminButton
              variant="danger"
              startIcon={<Trash2 size={14} />}
              onClick={() => {
                setConfirmOpen(true);
                setClearError(null);
              }}
              disabled={data.size_bytes === 0}
            >
              {t("admin.system.hls.clearCta")}
            </AdminButton>
          ) : undefined
        }
      />

      {isLoading && !data ? (
        <AdminCard>
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={22} color="primary" />
          </Box>
        </AdminCard>
      ) : isError || !data ? (
        <AdminCard>
          <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
            <Typography variant="body2" color="error">
              {t("admin.system.hls.errorLoading")}
            </Typography>
            <AdminButton variant="secondary" onClick={() => void refetch()}>
              {t("admin.table.retry")}
            </AdminButton>
          </Stack>
        </AdminCard>
      ) : (
        <OccupancyCard stats={data} />
      )}

      <AdminConfirmDialog
        open={confirmOpen}
        title={t("admin.system.hls.clear.title")}
        body={t("admin.system.hls.clear.body")}
        consequences={[
          t("admin.system.hls.clear.consequenceWipe"),
          t("admin.system.hls.clear.consequenceRetranscode"),
          t("admin.system.hls.clear.consequenceMarker"),
        ]}
        danger
        busy={clear.isPending}
        errorMessage={clearError}
        onCancel={() => {
          setConfirmOpen(false);
          setClearError(null);
        }}
        onConfirm={onConfirmClear}
        confirmLabel={t("admin.system.hls.clear.confirm")}
      />

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
