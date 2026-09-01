import { FormControlLabel, Stack, Switch } from "@mui/material";
import { Music } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type {
  AdminSettingDetail,
  IntroDetectionAlgorithm,
  IntroDetectionSettings,
} from "../../../api/types";
import { AdminFormSection, AdminInput, AdminSelect } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

const ALGORITHM_OPTIONS: IntroDetectionAlgorithm[] = ["frame_hash", "chromaprint"];

/** Sentinel for "no fallback" — AdminSelect values must be strings. */
const NO_FALLBACK = "none";

type FallbackChoice = IntroDetectionAlgorithm | typeof NO_FALLBACK;

interface Props {
  detail: AdminSettingDetail & { value: IntroDetectionSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Intro detection bucket — detector selection + per-algorithm tuning.
 *
 * A season the primary detector cannot crack is retried with
 * ``fallback_algorithm``, so both detectors can run in one pass and the
 * tuning section of each selected one is shown. Both the chromaprint
 * and frame_hash buckets are always sent on save so a detector that is
 * currently selected by neither keeps its persisted calibration. The
 * cross-field invariant ``min_intro_seconds < max_intro_seconds`` is
 * enforced on the backend and guarded locally so Save stays disabled
 * while invalid.
 */
export function IntroDetectionSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<IntroDetectionSettings>();

  // Lazy init only; the parent remounts via ``key`` when
  // ``updated_at`` changes, so we never need a re-hydrate effect.
  const [enabled, setEnabled] = useState(detail.value.enabled);
  const [algorithm, setAlgorithm] = useState<IntroDetectionAlgorithm>(detail.value.algorithm);
  const [fallback, setFallback] = useState<FallbackChoice>(
    detail.value.fallback_algorithm ?? NO_FALLBACK,
  );
  const [batchSize, setBatchSize] = useState(detail.value.batch_size);
  const [intervalMinutes, setIntervalMinutes] = useState(detail.value.interval_minutes);
  const [analysisWindowSeconds, setAnalysisWindowSeconds] = useState(
    detail.value.analysis_window_seconds,
  );
  const [minConfidence, setMinConfidence] = useState(detail.value.min_confidence);
  const [minIntroSeconds, setMinIntroSeconds] = useState(detail.value.min_intro_seconds);
  const [maxIntroSeconds, setMaxIntroSeconds] = useState(detail.value.max_intro_seconds);
  // Chromaprint tuning
  const [maxHashHamming, setMaxHashHamming] = useState(detail.value.chromaprint.max_hash_hamming);
  const [toleranceHashes, setToleranceHashes] = useState(
    detail.value.chromaprint.tolerance_hashes,
  );
  // Frame-hash tuning
  const [hashDistance, setHashDistance] = useState(
    detail.value.frame_hash.hash_distance_threshold,
  );
  const [frameSampleFps, setFrameSampleFps] = useState(detail.value.frame_hash.frame_sample_fps);
  const [matchToleranceFrames, setMatchToleranceFrames] = useState(
    detail.value.frame_hash.match_tolerance_frames,
  );
  const [maxGapSeconds, setMaxGapSeconds] = useState(detail.value.frame_hash.max_gap_seconds);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fallbackValue = fallback === NO_FALLBACK ? null : fallback;

  const dirty =
    enabled !== detail.value.enabled ||
    algorithm !== detail.value.algorithm ||
    fallbackValue !== (detail.value.fallback_algorithm ?? null) ||
    batchSize !== detail.value.batch_size ||
    intervalMinutes !== detail.value.interval_minutes ||
    analysisWindowSeconds !== detail.value.analysis_window_seconds ||
    minConfidence !== detail.value.min_confidence ||
    minIntroSeconds !== detail.value.min_intro_seconds ||
    maxIntroSeconds !== detail.value.max_intro_seconds ||
    maxHashHamming !== detail.value.chromaprint.max_hash_hamming ||
    toleranceHashes !== detail.value.chromaprint.tolerance_hashes ||
    hashDistance !== detail.value.frame_hash.hash_distance_threshold ||
    frameSampleFps !== detail.value.frame_hash.frame_sample_fps ||
    matchToleranceFrames !== detail.value.frame_hash.match_tolerance_frames ||
    maxGapSeconds !== detail.value.frame_hash.max_gap_seconds;

  const batchValid = Number.isFinite(batchSize) && batchSize >= 1;
  const intervalValid = Number.isFinite(intervalMinutes) && intervalMinutes >= 1;
  const windowValid = Number.isFinite(analysisWindowSeconds) && analysisWindowSeconds >= 60;
  const confidenceValid =
    Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1;
  const minIntroValid = Number.isFinite(minIntroSeconds) && minIntroSeconds >= 0;
  const maxIntroValid = Number.isFinite(maxIntroSeconds) && maxIntroSeconds >= 10;
  const boundsValid = minIntroSeconds < maxIntroSeconds;
  const hammingValid =
    Number.isFinite(maxHashHamming) && maxHashHamming >= 0 && maxHashHamming <= 32;
  const toleranceValid = Number.isFinite(toleranceHashes) && toleranceHashes >= 0;
  const hashDistanceValid =
    Number.isFinite(hashDistance) && hashDistance >= 0 && hashDistance <= 64;
  const fpsValid = Number.isFinite(frameSampleFps) && frameSampleFps > 0;
  const frameToleranceValid =
    Number.isFinite(matchToleranceFrames) && matchToleranceFrames >= 0;
  const gapValid = Number.isFinite(maxGapSeconds) && maxGapSeconds >= 0;

  const canSave =
    dirty &&
    batchValid &&
    intervalValid &&
    windowValid &&
    confidenceValid &&
    minIntroValid &&
    maxIntroValid &&
    boundsValid &&
    hammingValid &&
    toleranceValid &&
    hashDistanceValid &&
    fpsValid &&
    frameToleranceValid &&
    gapValid;

  // A fallback equal to the primary is a no-op on the backend, so
  // switching the primary onto it clears the pair instead of leaving a
  // selection that silently does nothing.
  const onAlgorithmChange = (next: IntroDetectionAlgorithm) => {
    setAlgorithm(next);
    if (fallback === next) setFallback(NO_FALLBACK);
  };

  const onReset = () => {
    setEnabled(detail.value.enabled);
    setAlgorithm(detail.value.algorithm);
    setFallback(detail.value.fallback_algorithm ?? NO_FALLBACK);
    setBatchSize(detail.value.batch_size);
    setIntervalMinutes(detail.value.interval_minutes);
    setAnalysisWindowSeconds(detail.value.analysis_window_seconds);
    setMinConfidence(detail.value.min_confidence);
    setMinIntroSeconds(detail.value.min_intro_seconds);
    setMaxIntroSeconds(detail.value.max_intro_seconds);
    setMaxHashHamming(detail.value.chromaprint.max_hash_hamming);
    setToleranceHashes(detail.value.chromaprint.tolerance_hashes);
    setHashDistance(detail.value.frame_hash.hash_distance_threshold);
    setFrameSampleFps(detail.value.frame_hash.frame_sample_fps);
    setMatchToleranceFrames(detail.value.frame_hash.match_tolerance_frames);
    setMaxGapSeconds(detail.value.frame_hash.max_gap_seconds);
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
          algorithm,
          fallback_algorithm: fallbackValue,
          batch_size: batchSize,
          interval_minutes: intervalMinutes,
          analysis_window_seconds: analysisWindowSeconds,
          min_confidence: minConfidence,
          min_intro_seconds: minIntroSeconds,
          max_intro_seconds: maxIntroSeconds,
          chromaprint: {
            max_hash_hamming: maxHashHamming,
            tolerance_hashes: toleranceHashes,
          },
          frame_hash: {
            hash_distance_threshold: hashDistance,
            frame_sample_fps: frameSampleFps,
            match_tolerance_frames: matchToleranceFrames,
            max_gap_seconds: maxGapSeconds,
          },
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
      dirty={dirty}
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
        title={t("admin.settings.introDetection.algorithm.label")}
        helper={t("admin.settings.introDetection.algorithm.helper")}
      >
        <Stack sx={{ maxWidth: 320 }}>
          <AdminSelect<IntroDetectionAlgorithm>
            value={algorithm}
            onChange={(e) => onAlgorithmChange(e.target.value as IntroDetectionAlgorithm)}
            options={ALGORITHM_OPTIONS.map((value) => ({
              value,
              label: t(`admin.settings.introDetection.algorithm.options.${value}.label`),
            }))}
            fullWidth
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.introDetection.fallback.label")}
        helper={t("admin.settings.introDetection.fallback.helper")}
      >
        <Stack sx={{ maxWidth: 320 }}>
          <AdminSelect<FallbackChoice>
            value={fallback}
            onChange={(e) => setFallback(e.target.value as FallbackChoice)}
            options={[
              {
                value: NO_FALLBACK,
                label: t("admin.settings.introDetection.fallback.options.none.label"),
              },
              ...ALGORITHM_OPTIONS.filter((value) => value !== algorithm).map((value) => ({
                value,
                label: t(`admin.settings.introDetection.algorithm.options.${value}.label`),
              })),
            ]}
            fullWidth
          />
        </Stack>
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
        title={t("admin.settings.introDetection.analysisWindow.label")}
        helper={t("admin.settings.introDetection.analysisWindow.helper")}
      >
        <Stack sx={{ maxWidth: 240 }}>
          <AdminInput
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
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.introDetection.confidence.label")}
        helper={t("admin.settings.introDetection.confidence.helper")}
      >
        <Stack sx={{ maxWidth: 240 }}>
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
          />
        </Stack>
      </AdminFormSection>

      {(algorithm === "chromaprint" || fallback === "chromaprint") && (
        <AdminFormSection
          title={t("admin.settings.introDetection.chromaprint.label")}
          helper={t("admin.settings.introDetection.chromaprint.helper")}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
            <AdminInput
              label={t("admin.settings.introDetection.maxHashHamming.label")}
              type="number"
              inputProps={{ min: 0, max: 32, step: 1 }}
              value={maxHashHamming}
              onChange={(e) => setMaxHashHamming(Number(e.target.value))}
              error={!hammingValid}
              helperText={!hammingValid ? t("admin.settings.errors.zeroTo32") : "0 – 32"}
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
      )}

      {(algorithm === "frame_hash" || fallback === "frame_hash") && (
        <AdminFormSection
          title={t("admin.settings.introDetection.frameHash.label")}
          helper={t("admin.settings.introDetection.frameHash.helper")}
        >
          <Stack spacing={2} sx={{ maxWidth: 720 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <AdminInput
                label={t("admin.settings.introDetection.hashDistanceThreshold.label")}
                type="number"
                inputProps={{ min: 0, max: 64, step: 1 }}
                value={hashDistance}
                onChange={(e) => setHashDistance(Number(e.target.value))}
                error={!hashDistanceValid}
                helperText={
                  !hashDistanceValid ? t("admin.settings.errors.zeroTo64") : "0 – 64"
                }
                sx={{ flex: 1 }}
              />
              <AdminInput
                label={t("admin.settings.introDetection.frameSampleFps.label")}
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
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <AdminInput
                label={t("admin.settings.introDetection.matchToleranceFrames.label")}
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={matchToleranceFrames}
                onChange={(e) => setMatchToleranceFrames(Number(e.target.value))}
                error={!frameToleranceValid}
                helperText={
                  !frameToleranceValid
                    ? t("admin.settings.errors.minZero")
                    : t("admin.settings.units.frames")
                }
                sx={{ flex: 1 }}
              />
              <AdminInput
                label={t("admin.settings.introDetection.maxGapSeconds.label")}
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={maxGapSeconds}
                onChange={(e) => setMaxGapSeconds(Number(e.target.value))}
                error={!gapValid}
                helperText={
                  !gapValid
                    ? t("admin.settings.errors.minZero")
                    : t("admin.settings.units.seconds")
                }
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </AdminFormSection>
      )}

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
