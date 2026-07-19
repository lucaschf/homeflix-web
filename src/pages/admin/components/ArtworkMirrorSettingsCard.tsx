import { FormControlLabel, Stack, Switch } from "@mui/material";
import { HardDriveDownload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type {
  AdminSettingDetail,
  ArtworkMirrorSettings,
} from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

const BYTES_PER_MB = 1024 * 1024;

interface Props {
  detail: AdminSettingDetail & { value: ArtworkMirrorSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Artwork mirror bucket — periodic job that downloads still-remote
 * poster/backdrop/logo/still images from the metadata provider and
 * stores them locally, so the catalog stops depending on the provider
 * CDN. ``max_bytes`` is edited in whole MB for readability and
 * converted back to bytes on save.
 */
export function ArtworkMirrorSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<ArtworkMirrorSettings>();

  const originalMaxMb = Math.round(detail.value.max_bytes / BYTES_PER_MB);

  // Lazy init from props; the parent remounts via ``key`` when
  // ``updated_at`` changes, so we never need a re-hydrate effect.
  const [enabled, setEnabled] = useState(detail.value.enabled);
  const [batchSize, setBatchSize] = useState(detail.value.batch_size);
  const [intervalMinutes, setIntervalMinutes] = useState(detail.value.interval_minutes);
  const [maxMb, setMaxMb] = useState(originalMaxMb);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty =
    enabled !== detail.value.enabled ||
    batchSize !== detail.value.batch_size ||
    intervalMinutes !== detail.value.interval_minutes ||
    maxMb !== originalMaxMb;

  const batchValid = Number.isFinite(batchSize) && batchSize >= 1;
  const intervalValid = Number.isFinite(intervalMinutes) && intervalMinutes >= 1;
  const maxMbValid = Number.isFinite(maxMb) && maxMb >= 1;
  const canSave = dirty && batchValid && intervalValid && maxMbValid;

  const onReset = () => {
    setEnabled(detail.value.enabled);
    setBatchSize(detail.value.batch_size);
    setIntervalMinutes(detail.value.interval_minutes);
    setMaxMb(originalMaxMb);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "artwork_mirror",
        payload: {
          enabled,
          batch_size: batchSize,
          interval_minutes: intervalMinutes,
          max_bytes: maxMb * BYTES_PER_MB,
        },
      });
      onSuccess(t("admin.settings.artworkMirror.snack.saved"));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={HardDriveDownload}
      title={t("admin.settings.artworkMirror.title")}
      subtitle={t("admin.settings.artworkMirror.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      dirty={dirty}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      <AdminFormSection
        title={t("admin.settings.artworkMirror.enabled.label")}
        helper={t("admin.settings.artworkMirror.enabled.helper")}
      >
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(_e, checked) => setEnabled(checked)}
              color="primary"
            />
          }
          label={
            enabled
              ? t("admin.settings.switch.on")
              : t("admin.settings.switch.off")
          }
        />
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.artworkMirror.cadence.label")}
        helper={t("admin.settings.artworkMirror.cadence.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.artworkMirror.batchSize.label")}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            error={!batchValid}
            helperText={
              !batchValid
                ? t("admin.settings.errors.minOne")
                : t("admin.settings.units.items")
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.artworkMirror.interval.label")}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            error={!intervalValid}
            helperText={
              !intervalValid
                ? t("admin.settings.errors.minOne")
                : t("admin.settings.units.minutes")
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.artworkMirror.maxSize.label")}
        helper={t("admin.settings.artworkMirror.maxSize.helper")}
      >
        <Stack sx={{ maxWidth: 260 }}>
          <AdminInput
            label={t("admin.settings.artworkMirror.maxSize.field")}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={maxMb}
            onChange={(e) => setMaxMb(Number(e.target.value))}
            error={!maxMbValid}
            helperText={
              !maxMbValid
                ? t("admin.settings.errors.minOne")
                : t("admin.settings.units.megabytes")
            }
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
