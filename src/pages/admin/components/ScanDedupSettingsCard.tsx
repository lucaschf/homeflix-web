import { FormControlLabel, Stack, Switch } from "@mui/material";
import { CopyCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type { AdminSettingDetail, ScanDedupSettings } from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

interface Props {
  detail: AdminSettingDetail & { value: ScanDedupSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Scan-dedup bucket — runtime-delta thresholds for the post-enrich
 * conflict detector (ADR-015 Phase 4). A detected duplicate is only
 * flagged as a suspected different edit (Director's Cut / Theatrical)
 * when its runtime delta exceeds BOTH the absolute and the relative
 * bound; either alone is satisfied by routine encoding differences.
 */
export function ScanDedupSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<ScanDedupSettings>();

  const [absMinutes, setAbsMinutes] = useState(detail.value.runtime_delta_abs_minutes);
  const [relative, setRelative] = useState(detail.value.runtime_delta_relative);
  const [fallbackEnabled, setFallbackEnabled] = useState(
    detail.value.title_year_fallback_enabled,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty =
    absMinutes !== detail.value.runtime_delta_abs_minutes ||
    relative !== detail.value.runtime_delta_relative ||
    fallbackEnabled !== detail.value.title_year_fallback_enabled;

  const absValid = Number.isFinite(absMinutes) && absMinutes >= 0;
  const relativeValid = Number.isFinite(relative) && relative >= 0 && relative <= 1;
  const canSave = dirty && absValid && relativeValid;

  const onReset = () => {
    setAbsMinutes(detail.value.runtime_delta_abs_minutes);
    setRelative(detail.value.runtime_delta_relative);
    setFallbackEnabled(detail.value.title_year_fallback_enabled);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "scan_dedup",
        payload: {
          runtime_delta_abs_minutes: absMinutes,
          runtime_delta_relative: relative,
          title_year_fallback_enabled: fallbackEnabled,
        },
      });
      onSuccess(t("admin.settings.scanDedup.snack.saved"));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={CopyCheck}
      title={t("admin.settings.scanDedup.title")}
      subtitle={t("admin.settings.scanDedup.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      <AdminFormSection
        title={t("admin.settings.scanDedup.thresholds.label")}
        helper={t("admin.settings.scanDedup.thresholds.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.scanDedup.absMinutes.label")}
            type="number"
            inputProps={{ min: 0, step: 0.5 }}
            value={absMinutes}
            onChange={(e) => setAbsMinutes(Number(e.target.value))}
            error={!absValid}
            helperText={
              !absValid
                ? t("admin.settings.errors.minZero")
                : t("admin.settings.units.minutes")
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.scanDedup.relative.label")}
            type="number"
            inputProps={{ min: 0, max: 1, step: 0.05 }}
            value={relative}
            onChange={(e) => setRelative(Number(e.target.value))}
            error={!relativeValid}
            helperText={
              !relativeValid ? t("admin.settings.errors.zeroToOne") : "0.0 – 1.0"
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.scanDedup.fallback.label")}
        helper={t("admin.settings.scanDedup.fallback.helper")}
      >
        <FormControlLabel
          control={
            <Switch
              checked={fallbackEnabled}
              onChange={(_e, checked) => setFallbackEnabled(checked)}
              color="primary"
            />
          }
          label={
            fallbackEnabled
              ? t("admin.settings.switch.on")
              : t("admin.settings.switch.off")
          }
        />
      </AdminFormSection>
    </SettingsCardShell>
  );
}
