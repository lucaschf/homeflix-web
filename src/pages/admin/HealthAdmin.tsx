import { Box, CircularProgress, Typography } from "@mui/material";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReadiness } from "../../api/hooks";
import {
  AdminBadge,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  type BadgeTone,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const HEALTH_TONE_BY_STATUS: Record<string, BadgeTone> = {
  healthy: "ok",
  ready: "ok",
  ok: "ok",
  up: "ok",
  degraded: "warn",
  warning: "warn",
  unknown: "warn",
  not_ready: "err",
  unhealthy: "err",
  down: "err",
  failed: "err",
  error: "err",
};

function toneFor(status: string): BadgeTone {
  return HEALTH_TONE_BY_STATUS[status.toLowerCase()] ?? "warn";
}

function HealthRow({ label, status }: { label: string; status: string }) {
  const tone = toneFor(status);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        py: 1.25,
        px: 1.5,
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 1,
        bgcolor: "rgba(255,255,255,0.015)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            bgcolor:
              tone === "ok"
                ? "#7ec488"
                : tone === "warn"
                  ? "#f3c266"
                  : tone === "err"
                    ? "#ff8a7a"
                    : "rgba(255,255,255,0.4)",
          }}
        />
        <Typography
          variant="body2"
          sx={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "0.8125rem",
            color: "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
      </Box>
      <AdminBadge tone={tone}>{status}</AdminBadge>
    </Box>
  );
}

/**
 * Dedicated System → Health page. Polls ``/health/ready`` every
 * 30 s via the shared ``useReadiness`` hook (same source as the
 * Overview's compact card) and lists one row per backing
 * dependency the backend reports.
 */
export function HealthAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.system.health.title"));

  const { data, isLoading, isError, dataUpdatedAt } = useReadiness();
  const lastCheckedAt =
    dataUpdatedAt && data
      ? new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.system"), t("admin.nav.health")]}
        title={t("admin.system.health.title")}
        subtitle={t("admin.system.health.subtitle")}
      />

      <AdminCard>
        <AdminCardHeader
          icon={Heart}
          title={t("admin.system.health.cardTitle")}
          subtitle={
            lastCheckedAt
              ? t("admin.system.health.lastChecked", { at: lastCheckedAt })
              : t("admin.system.health.cardSubtitle")
          }
        />

        {isLoading && !data ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={20} color="primary" />
          </Box>
        ) : isError || !data ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="error">
              {t("admin.system.health.error")}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
              gap: 1.5,
            }}
          >
            <HealthRow label={t("admin.system.health.overall")} status={data.status} />
            {Object.entries(data.checks ?? {}).map(([name, status]) => (
              <HealthRow key={name} label={name} status={status} />
            ))}
          </Box>
        )}
      </AdminCard>
    </>
  );
}
