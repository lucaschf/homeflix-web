import { FormControlLabel, Stack, Switch } from "@mui/material";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type {
  AdminSettingDetail,
  ThumbnailBackfillSettings,
} from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

interface Props {
  detail: AdminSettingDetail & { value: ThumbnailBackfillSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Thumbnail backfill bucket — periodic job that fills in scrub-
 * preview sprites for items the operator hasn't streamed yet. Lower
 * ``batch_size`` smooths CPU usage; higher catches up faster on a
 * fresh catalog.
 */
export function ThumbnailBackfillSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<ThumbnailBackfillSettings>();

  // Lazy init from props; the parent remounts via ``key`` when
  // ``updated_at`` changes, so we never need a re-hydrate effect.
  const [enabled, setEnabled] = useState(detail.value.enabled);
  const [batchSize, setBatchSize] = useState(detail.value.batch_size);
  const [intervalMinutes, setIntervalMinutes] = useState(detail.value.interval_minutes);
  const [subdir, setSubdir] = useState(detail.value.subdir);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty =
    enabled !== detail.value.enabled ||
    batchSize !== detail.value.batch_size ||
    intervalMinutes !== detail.value.interval_minutes ||
    subdir !== detail.value.subdir;

  const batchValid = Number.isFinite(batchSize) && batchSize >= 1;
  const intervalValid = Number.isFinite(intervalMinutes) && intervalMinutes >= 1;
  const subdirValid = subdir.trim().length >= 1;
  const canSave = dirty && batchValid && intervalValid && subdirValid;

  const onReset = () => {
    setEnabled(detail.value.enabled);
    setBatchSize(detail.value.batch_size);
    setIntervalMinutes(detail.value.interval_minutes);
    setSubdir(detail.value.subdir);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "thumbnail_backfill",
        payload: {
          enabled,
          batch_size: batchSize,
          interval_minutes: intervalMinutes,
          subdir: subdir.trim(),
        },
      });
      onSuccess(t("admin.settings.thumbnailBackfill.snack.saved"));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={ImageIcon}
      title={t("admin.settings.thumbnailBackfill.title")}
      subtitle={t("admin.settings.thumbnailBackfill.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      <AdminFormSection
        title={t("admin.settings.thumbnailBackfill.enabled.label")}
        helper={t("admin.settings.thumbnailBackfill.enabled.helper")}
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
        title={t("admin.settings.thumbnailBackfill.cadence.label")}
        helper={t("admin.settings.thumbnailBackfill.cadence.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.thumbnailBackfill.batchSize.label")}
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
            label={t("admin.settings.thumbnailBackfill.interval.label")}
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
        title={t("admin.settings.thumbnailBackfill.subdir.label")}
        helper={t("admin.settings.thumbnailBackfill.subdir.helper")}
      >
        <Stack sx={{ maxWidth: 480 }}>
          <AdminInput
            mono
            value={subdir}
            onChange={(e) => setSubdir(e.target.value)}
            error={!subdirValid}
            helperText={
              !subdirValid ? t("admin.settings.errors.required") : undefined
            }
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
