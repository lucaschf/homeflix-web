import { FormControlLabel, Stack, Switch } from "@mui/material";
import { Music } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type { AdminSettingDetail, IntroDetectionSettings } from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

interface Props {
  detail: AdminSettingDetail & { value: IntroDetectionSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Intro detection bucket — Chromaprint detector calibration. The
 * cross-field invariant ``min_intro_seconds < max_intro_seconds`` is
 * checked on the backend's Pydantic ``model_validator`` and surfaced
 * here as a save-time error; we additionally guard locally so the
 * Save button stays disabled while the form is in an invalid state.
 */
export function IntroDetectionSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<IntroDetectionSettings>();

  const [enabled, setEnabled] = useState(detail.value.enabled);
  const [batchSize, setBatchSize] = useState(detail.value.batch_size);
  const [intervalMinutes, setIntervalMinutes] = useState(detail.value.interval_minutes);
  const [audioWindowSeconds, setAudioWindowSeconds] = useState(
    detail.value.audio_window_seconds,
  );
  const [minConfidence, setMinConfidence] = useState(detail.value.min_confidence);
  const [maxHashHamming, setMaxHashHamming] = useState(detail.value.max_hash_hamming);
  const [toleranceHashes, setToleranceHashes] = useState(detail.value.tolerance_hashes);
  const [minIntroSeconds, setMinIntroSeconds] = useState(detail.value.min_intro_seconds);
  const [maxIntroSeconds, setMaxIntroSeconds] = useState(detail.value.max_intro_seconds);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lazy init only; the parent remounts via ``key`` when
  // ``updated_at`` changes, so we never need a re-hydrate effect.

  const dirty =
    enabled !== detail.value.enabled ||
    batchSize !== detail.value.batch_size ||
    intervalMinutes !== detail.value.interval_minutes ||
    audioWindowSeconds !== detail.value.audio_window_seconds ||
    minConfidence !== detail.value.min_confidence ||
    maxHashHamming !== detail.value.max_hash_hamming ||
    toleranceHashes !== detail.value.tolerance_hashes ||
    minIntroSeconds !== detail.value.min_intro_seconds ||
    maxIntroSeconds !== detail.value.max_intro_seconds;

  const batchValid = Number.isFinite(batchSize) && batchSize >= 1;
  const intervalValid = Number.isFinite(intervalMinutes) && intervalMinutes >= 1;
  const audioWindowValid =
    Number.isFinite(audioWindowSeconds) && audioWindowSeconds >= 60;
  const confidenceValid =
    Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1;
  const hammingValid =
    Number.isFinite(maxHashHamming) && maxHashHamming >= 0 && maxHashHamming <= 32;
  const toleranceValid = Number.isFinite(toleranceHashes) && toleranceHashes >= 0;
  const minIntroValid = Number.isFinite(minIntroSeconds) && minIntroSeconds >= 0;
  const maxIntroValid = Number.isFinite(maxIntroSeconds) && maxIntroSeconds >= 10;
  const boundsValid = minIntroSeconds < maxIntroSeconds;
  const canSave =
    dirty &&
    batchValid &&
    intervalValid &&
    audioWindowValid &&
    confidenceValid &&
    hammingValid &&
    toleranceValid &&
    minIntroValid &&
    maxIntroValid &&
    boundsValid;

  const onReset = () => {
    setEnabled(detail.value.enabled);
    setBatchSize(detail.value.batch_size);
    setIntervalMinutes(detail.value.interval_minutes);
    setAudioWindowSeconds(detail.value.audio_window_seconds);
    setMinConfidence(detail.value.min_confidence);
    setMaxHashHamming(detail.value.max_hash_hamming);
    setToleranceHashes(detail.value.tolerance_hashes);
    setMinIntroSeconds(detail.value.min_intro_seconds);
    setMaxIntroSeconds(detail.value.max_intro_seconds);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "intro_detection",
        payload: {
          enabled,
          batch_size: batchSize,
          interval_minutes: intervalMinutes,
          audio_window_seconds: audioWindowSeconds,
          min_confidence: minConfidence,
          max_hash_hamming: maxHashHamming,
          tolerance_hashes: toleranceHashes,
          min_intro_seconds: minIntroSeconds,
          max_intro_seconds: maxIntroSeconds,
        },
      });
      onSuccess(t("admin.settings.introDetection.snack.saved"));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={Music}
      title={t("admin.settings.introDetection.title")}
      subtitle={t("admin.settings.introDetection.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      <AdminFormSection
        title={t("admin.settings.introDetection.enabled.label")}
        helper={t("admin.settings.introDetection.enabled.helper")}
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
        title={t("admin.settings.introDetection.cadence.label")}
        helper={t("admin.settings.introDetection.cadence.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.introDetection.batchSize.label")}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            error={!batchValid}
            helperText={
              !batchValid
                ? t("admin.settings.errors.minOne")
                : t("admin.settings.units.seasons")
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.introDetection.interval.label")}
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
        title={t("admin.settings.introDetection.audioWindow.label")}
        helper={t("admin.settings.introDetection.audioWindow.helper")}
      >
        <Stack sx={{ maxWidth: 240 }}>
          <AdminInput
            type="number"
            inputProps={{ min: 60, step: 30 }}
            value={audioWindowSeconds}
            onChange={(e) => setAudioWindowSeconds(Number(e.target.value))}
            error={!audioWindowValid}
            helperText={
              !audioWindowValid
                ? t("admin.settings.errors.minSixty")
                : t("admin.settings.units.seconds")
            }
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.introDetection.matching.label")}
        helper={t("admin.settings.introDetection.matching.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 720 }}>
          <AdminInput
            label={t("admin.settings.introDetection.minConfidence.label")}
            type="number"
            inputProps={{ min: 0, max: 1, step: 0.05 }}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            error={!confidenceValid}
            helperText={
              !confidenceValid ? t("admin.settings.errors.zeroToOne") : "0.0 – 1.0"
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.introDetection.maxHashHamming.label")}
            type="number"
            inputProps={{ min: 0, max: 32, step: 1 }}
            value={maxHashHamming}
            onChange={(e) => setMaxHashHamming(Number(e.target.value))}
            error={!hammingValid}
            helperText={
              !hammingValid ? t("admin.settings.errors.zeroTo32") : "0 – 32"
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.introDetection.toleranceHashes.label")}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={toleranceHashes}
            onChange={(e) => setToleranceHashes(Number(e.target.value))}
            error={!toleranceValid}
            helperText={
              !toleranceValid
                ? t("admin.settings.errors.minZero")
                : t("admin.settings.units.hashes")
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.introDetection.bounds.label")}
        helper={t("admin.settings.introDetection.bounds.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.introDetection.minIntroSeconds.label")}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={minIntroSeconds}
            onChange={(e) => setMinIntroSeconds(Number(e.target.value))}
            error={!minIntroValid || !boundsValid}
            helperText={
              !minIntroValid
                ? t("admin.settings.errors.minZero")
                : !boundsValid
                  ? t("admin.settings.errors.minLessThanMax")
                  : t("admin.settings.units.seconds")
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.introDetection.maxIntroSeconds.label")}
            type="number"
            inputProps={{ min: 10, step: 1 }}
            value={maxIntroSeconds}
            onChange={(e) => setMaxIntroSeconds(Number(e.target.value))}
            error={!maxIntroValid || !boundsValid}
            helperText={
              !maxIntroValid
                ? t("admin.settings.errors.minTen")
                : t("admin.settings.units.seconds")
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
