import { FormControlLabel, Stack, Switch } from "@mui/material";
import { Clock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type { AdminSettingDetail, SchedulerSettings } from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

interface SchedulerSettingsCardProps {
  detail: AdminSettingDetail & { value: SchedulerSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Scheduler bucket — master switch + reconcile interval. Reconcile
 * cadence is how often APScheduler re-reads library schedules, so
 * lower values pick up schedule edits sooner at the cost of idle DB
 * chatter.
 */
export function SchedulerSettingsCard({
  detail,
  onSuccess,
  onError,
}: SchedulerSettingsCardProps) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<SchedulerSettings>();

  // Initial form values come straight from the hydrated row; the
  // parent remounts the card (via ``key={detail.updated_at}``) when
  // a save completes, so we never need a manual re-hydration effect
  // and unsaved edits survive across re-renders that don't bump
  // ``updated_at``.
  const [enabled, setEnabled] = useState(detail.value.enabled);
  const [reconcileMinutes, setReconcileMinutes] = useState(
    detail.value.reconcile_interval_minutes,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty =
    enabled !== detail.value.enabled ||
    reconcileMinutes !== detail.value.reconcile_interval_minutes;
  const intervalValid = Number.isFinite(reconcileMinutes) && reconcileMinutes >= 1;
  const canSave = dirty && intervalValid;

  const onReset = () => {
    setEnabled(detail.value.enabled);
    setReconcileMinutes(detail.value.reconcile_interval_minutes);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "scheduler",
        payload: { enabled, reconcile_interval_minutes: reconcileMinutes },
      });
      onSuccess(t("admin.settings.scheduler.snack.saved"));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={Clock}
      title={t("admin.settings.scheduler.title")}
      subtitle={t("admin.settings.scheduler.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      <AdminFormSection
        title={t("admin.settings.scheduler.enabled.label")}
        helper={t("admin.settings.scheduler.enabled.helper")}
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
        title={t("admin.settings.scheduler.reconcile.label")}
        helper={t("admin.settings.scheduler.reconcile.helper")}
      >
        <Stack sx={{ maxWidth: 240 }}>
          <AdminInput
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={reconcileMinutes}
            onChange={(e) => setReconcileMinutes(Number(e.target.value))}
            error={!intervalValid}
            helperText={
              !intervalValid
                ? t("admin.settings.errors.minOne")
                : t("admin.settings.units.minutes")
            }
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
