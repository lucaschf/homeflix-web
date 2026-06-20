import { Alert, Box, CircularProgress, Snackbar, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminSettings } from "../../api/hooks";
import type {
  AdminSettingDetail,
  AdminSettingKey,
  AvatarSettings,
  CreditsDetectionSettings,
  IntroDetectionSettings,
  ScanDedupSettings,
  SchedulerSettings,
  StreamingSettings,
  ThumbnailBackfillSettings,
} from "../../api/types";
import {
  AdminButton,
  AdminCard,
  AdminPageHeader,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { status, whiteAlpha } from "../../theme/tokens";
import { AvatarSettingsCard } from "./components/AvatarSettingsCard";
import { CreditsDetectionSettingsCard } from "./components/CreditsDetectionSettingsCard";
import { IntroDetectionSettingsCard } from "./components/IntroDetectionSettingsCard";
import { ScanDedupSettingsCard } from "./components/ScanDedupSettingsCard";
import { SchedulerSettingsCard } from "./components/SchedulerSettingsCard";
import { StreamingSettingsCard } from "./components/StreamingSettingsCard";
import { ThumbnailBackfillSettingsCard } from "./components/ThumbnailBackfillSettingsCard";

type Snack = { message: string; severity: "success" | "error" } | null;

function detailFor<K extends AdminSettingKey>(
  details: AdminSettingDetail[],
  key: K,
): AdminSettingDetail | undefined {
  return details.find((d) => d.key === key);
}

/**
 * Runtime-settings admin page (ADR-013 phase 4).
 *
 * Renders one card per settings bucket — Scheduler, Thumbnail
 * backfill, Intro detection, Streaming, Avatar. Each card owns its
 * own form state, validation and Save mutation; cards don't share
 * state with each other so editing one bucket never marks the
 * others dirty.
 *
 * The page does the single ``GET /admin/settings`` round-trip and
 * hands the matching ``AdminSettingDetail`` slice to each card.
 * Buckets that have never been persisted come back synthesised with
 * ``source: "default"`` — cards hydrate from those defaults the same
 * way they hydrate from admin-edited rows.
 *
 * A single page-level Snackbar surfaces save outcomes; per-card
 * inline errors stay inside the relevant card so the operator
 * always sees them next to the field they were editing.
 */
export function SettingsAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.settings.title"));

  const { data, isLoading, isError, refetch } = useAdminSettings();
  const [snack, setSnack] = useState<Snack>(null);

  const notifySuccess = (message: string) =>
    setSnack({ message, severity: "success" });
  const notifyError = (message: string) =>
    setSnack({ message, severity: "error" });

  if (isLoading && !data) {
    return (
      <>
        <AdminPageHeader
          breadcrumb={[t("admin.nav.group.system"), t("admin.nav.settings")]}
          title={t("admin.settings.title")}
          subtitle={t("admin.settings.subtitle")}
        />
        <AdminCard>
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={22} color="primary" />
          </Box>
        </AdminCard>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <AdminPageHeader
          breadcrumb={[t("admin.nav.group.system"), t("admin.nav.settings")]}
          title={t("admin.settings.title")}
          subtitle={t("admin.settings.subtitle")}
        />
        <AdminCard>
          <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
            <Typography variant="body2" color="error">
              {t("admin.settings.errorLoading")}
            </Typography>
            <AdminButton variant="secondary" onClick={() => void refetch()}>
              {t("admin.table.retry")}
            </AdminButton>
          </Stack>
        </AdminCard>
      </>
    );
  }

  const scheduler = detailFor(data, "scheduler");
  const thumbnailBackfill = detailFor(data, "thumbnail_backfill");
  const introDetection = detailFor(data, "intro_detection");
  const creditsDetection = detailFor(data, "credits_detection");
  const streaming = detailFor(data, "streaming");
  const avatar = detailFor(data, "avatar");
  const scanDedup = detailFor(data, "scan_dedup");

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.system"), t("admin.nav.settings")]}
        title={t("admin.settings.title")}
        subtitle={t("admin.settings.subtitle")}
      />

      <Alert
        severity="info"
        variant="outlined"
        sx={{
          mb: 3,
          bgcolor: whiteAlpha(0.015),
          borderColor: whiteAlpha(0.08),
          color: "text.secondary",
          "& .MuiAlert-icon": { color: "primary.main" },
        }}
      >
        {t("admin.settings.propagationNote")}
      </Alert>

      <Stack spacing={3}>
        {scheduler && (
          <SchedulerSettingsCard
            key={scheduler.updated_at ?? "default"}
            detail={{
              ...scheduler,
              value: scheduler.value as SchedulerSettings,
            }}
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        )}
        {thumbnailBackfill && (
          <ThumbnailBackfillSettingsCard
            key={thumbnailBackfill.updated_at ?? "default"}
            detail={{
              ...thumbnailBackfill,
              value: thumbnailBackfill.value as ThumbnailBackfillSettings,
            }}
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        )}
        {introDetection && (
          <IntroDetectionSettingsCard
            key={introDetection.updated_at ?? "default"}
            detail={{
              ...introDetection,
              value: introDetection.value as IntroDetectionSettings,
            }}
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        )}
        {creditsDetection && (
          <CreditsDetectionSettingsCard
            key={creditsDetection.updated_at ?? "default"}
            detail={{
              ...creditsDetection,
              value: creditsDetection.value as CreditsDetectionSettings,
            }}
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        )}
        {streaming && (
          <StreamingSettingsCard
            key={streaming.updated_at ?? "default"}
            detail={{
              ...streaming,
              value: streaming.value as StreamingSettings,
            }}
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        )}
        {avatar && (
          <AvatarSettingsCard
            key={avatar.updated_at ?? "default"}
            detail={{
              ...avatar,
              value: avatar.value as AvatarSettings,
            }}
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        )}
        {scanDedup && (
          <ScanDedupSettingsCard
            key={scanDedup.updated_at ?? "default"}
            detail={{
              ...scanDedup,
              value: scanDedup.value as ScanDedupSettings,
            }}
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        )}
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
