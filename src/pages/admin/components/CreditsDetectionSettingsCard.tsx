import { FormControlLabel, Stack, Switch } from "@mui/material";
import { Clapperboard } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type { AdminSettingDetail, CreditsDetectionSettings } from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

interface Props {
  detail: AdminSettingDetail & { value: CreditsDetectionSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Credits detection bucket — per-file combined detector (edge + motion).
 *
 * Unlike intro detection there is no algorithm selection: one detector
 * runs both signals and keeps the latest-onset candidate. Detection is
 * best-effort, so ``min_confidence`` defaults low and a manual editor
 * backs up the misses.
 */
export function CreditsDetectionSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<CreditsDetectionSettings>();

  // Lazy init only; the parent remounts via ``key`` on ``updated_at``.
  const [enabled, setEnabled] = useState(detail.value.enabled);
  const [batchSize, setBatchSize] = useState(detail.value.batch_size);
  const [intervalMinutes, setIntervalMinutes] = useState(detail.value.interval_minutes);
  const [analysisWindowSeconds, setAnalysisWindowSeconds] = useState(
    detail.value.analysis_window_seconds,
  );
  const [frameSampleFps, setFrameSampleFps] = useState(detail.value.frame_sample_fps);
  const [minConfidence, setMinConfidence] = useState(detail.value.min_confidence);
  const [minCreditsSeconds, setMinCreditsSeconds] = useState(detail.value.min_credits_seconds);
  const [edgeRelFactor, setEdgeRelFactor] = useState(detail.value.edge_rel_factor);
  const [motionRelFactor, setMotionRelFactor] = useState(detail.value.motion_rel_factor);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty =
    enabled !== detail.value.enabled ||
    batchSize !== detail.value.batch_size ||
    intervalMinutes !== detail.value.interval_minutes ||
    analysisWindowSeconds !== detail.value.analysis_window_seconds ||
    frameSampleFps !== detail.value.frame_sample_fps ||
    minConfidence !== detail.value.min_confidence ||
    minCreditsSeconds !== detail.value.min_credits_seconds ||
    edgeRelFactor !== detail.value.edge_rel_factor ||
    motionRelFactor !== detail.value.motion_rel_factor;

  const batchValid = Number.isFinite(batchSize) && batchSize >= 1;
  const intervalValid = Number.isFinite(intervalMinutes) && intervalMinutes >= 1;
  const windowValid = Number.isFinite(analysisWindowSeconds) && analysisWindowSeconds >= 60;
  const fpsValid = Number.isFinite(frameSampleFps) && frameSampleFps > 0;
  const confidenceValid =
    Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1;
  const minCreditsValid = Number.isFinite(minCreditsSeconds) && minCreditsSeconds >= 1;
  const edgeValid = Number.isFinite(edgeRelFactor) && edgeRelFactor > 1;
  const motionValid = Number.isFinite(motionRelFactor) && motionRelFactor > 0 && motionRelFactor < 1;

  const canSave =
    dirty &&
    batchValid &&
    intervalValid &&
    windowValid &&
    fpsValid &&
    confidenceValid &&
    minCreditsValid &&
    edgeValid &&
    motionValid;

  const onReset = () => {
    setEnabled(detail.value.enabled);
    setBatchSize(detail.value.batch_size);
    setIntervalMinutes(detail.value.interval_minutes);
    setAnalysisWindowSeconds(detail.value.analysis_window_seconds);
    setFrameSampleFps(detail.value.frame_sample_fps);
    setMinConfidence(detail.value.min_confidence);
    setMinCreditsSeconds(detail.value.min_credits_seconds);
    setEdgeRelFactor(detail.value.edge_rel_factor);
    setMotionRelFactor(detail.value.motion_rel_factor);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "credits_detection",
        payload: {
          enabled,
          batch_size: batchSize,
          interval_minutes: intervalMinutes,
          analysis_window_seconds: analysisWindowSeconds,
          frame_sample_fps: frameSampleFps,
          min_confidence: minConfidence,
          min_credits_seconds: minCreditsSeconds,
          edge_rel_factor: edgeRelFactor,
          motion_rel_factor: motionRelFactor,
        },
      });
      onSuccess(t("admin.settings.creditsDetection.snack.saved"));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={Clapperboard}
      title={t("admin.settings.creditsDetection.title")}
      subtitle={t("admin.settings.creditsDetection.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      <AdminFormSection
        title={t("admin.settings.creditsDetection.enabled.label")}
        helper={t("admin.settings.creditsDetection.enabled.helper")}
      >
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(_e, checked) => setEnabled(checked)}
              color="primary"
            />
          }
          label={enabled ? t("admin.settings.switch.on") : t("admin.settings.switch.off")}
        />
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.creditsDetection.cadence.label")}
        helper={t("admin.settings.creditsDetection.cadence.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.creditsDetection.batchSize.label")}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            error={!batchValid}
            helperText={
              !batchValid ? t("admin.settings.errors.minOne") : t("admin.settings.units.files")
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.creditsDetection.interval.label")}
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
        title={t("admin.settings.creditsDetection.sampling.label")}
        helper={t("admin.settings.creditsDetection.sampling.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.creditsDetection.analysisWindow.label")}
            type="number"
            inputProps={{ min: 60, step: 30 }}
            value={analysisWindowSeconds}
            onChange={(e) => setAnalysisWindowSeconds(Number(e.target.value))}
            error={!windowValid}
            helperText={
              !windowValid
                ? t("admin.settings.errors.minSixty")
                : t("admin.settings.units.seconds")
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.creditsDetection.frameSampleFps.label")}
            type="number"
            inputProps={{ min: 0.5, step: 0.5 }}
            value={frameSampleFps}
            onChange={(e) => setFrameSampleFps(Number(e.target.value))}
            error={!fpsValid}
            helperText={
              !fpsValid
                ? t("admin.settings.errors.greaterThanZero")
                : t("admin.settings.units.fps")
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.creditsDetection.confidence.label")}
        helper={t("admin.settings.creditsDetection.confidence.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.creditsDetection.minConfidence.label")}
            type="number"
            inputProps={{ min: 0, max: 1, step: 0.05 }}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            error={!confidenceValid}
            helperText={!confidenceValid ? t("admin.settings.errors.zeroToOne") : "0.0 – 1.0"}
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.creditsDetection.minCreditsSeconds.label")}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={minCreditsSeconds}
            onChange={(e) => setMinCreditsSeconds(Number(e.target.value))}
            error={!minCreditsValid}
            helperText={
              !minCreditsValid
                ? t("admin.settings.errors.minOne")
                : t("admin.settings.units.seconds")
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.creditsDetection.thresholds.label")}
        helper={t("admin.settings.creditsDetection.thresholds.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.creditsDetection.edgeRelFactor.label")}
            type="number"
            inputProps={{ min: 1, step: 0.05 }}
            value={edgeRelFactor}
            onChange={(e) => setEdgeRelFactor(Number(e.target.value))}
            error={!edgeValid}
            helperText={!edgeValid ? t("admin.settings.errors.greaterThanOne") : "> 1.0"}
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.creditsDetection.motionRelFactor.label")}
            type="number"
            inputProps={{ min: 0, max: 1, step: 0.05 }}
            value={motionRelFactor}
            onChange={(e) => setMotionRelFactor(Number(e.target.value))}
            error={!motionValid}
            helperText={!motionValid ? t("admin.settings.errors.betweenZeroOne") : "0.0 – 1.0"}
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
