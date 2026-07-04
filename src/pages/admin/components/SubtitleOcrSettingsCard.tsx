import { FormControlLabel, Stack, Switch } from "@mui/material";
import { Captions } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type { AdminSettingDetail, SubtitleOcrSettings } from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

interface Props {
  detail: AdminSettingDetail & { value: SubtitleOcrSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/** Parse a comma/space separated language list into normalized ISO codes. */
function parseLanguages(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((code) => code.trim().toLowerCase())
    .filter((code) => code.length > 0);
}

/**
 * Subtitle OCR bucket — OCR image-based (PGS/SUP) subtitles into text
 * WebVTT sidecars so they become selectable in the player (ADR-027).
 *
 * Off by default and best-effort: requires ffmpeg + tesseract (with the
 * relevant language data) on the host. Leave languages empty to OCR
 * every track whose language has an installed tesseract model.
 */
export function SubtitleOcrSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<SubtitleOcrSettings>();

  // Lazy init only; the parent remounts via ``key`` on ``updated_at``.
  const [enabled, setEnabled] = useState(detail.value.enabled);
  const [batchSize, setBatchSize] = useState(detail.value.batch_size);
  const [intervalMinutes, setIntervalMinutes] = useState(detail.value.interval_minutes);
  const [languagesText, setLanguagesText] = useState(detail.value.languages.join(", "));
  const [tesseractBinary, setTesseractBinary] = useState(detail.value.tesseract_binary);
  const [perCueTimeout, setPerCueTimeout] = useState(detail.value.per_cue_timeout_seconds);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const languages = parseLanguages(languagesText);

  const dirty =
    enabled !== detail.value.enabled ||
    batchSize !== detail.value.batch_size ||
    intervalMinutes !== detail.value.interval_minutes ||
    languages.join(",") !== detail.value.languages.join(",") ||
    tesseractBinary.trim() !== detail.value.tesseract_binary ||
    perCueTimeout !== detail.value.per_cue_timeout_seconds;

  const batchValid = Number.isFinite(batchSize) && batchSize >= 1;
  const intervalValid = Number.isFinite(intervalMinutes) && intervalMinutes >= 1;
  const timeoutValid = Number.isFinite(perCueTimeout) && perCueTimeout >= 1;
  const binaryValid = tesseractBinary.trim().length > 0;

  const canSave = dirty && batchValid && intervalValid && timeoutValid && binaryValid;

  const onReset = () => {
    setEnabled(detail.value.enabled);
    setBatchSize(detail.value.batch_size);
    setIntervalMinutes(detail.value.interval_minutes);
    setLanguagesText(detail.value.languages.join(", "));
    setTesseractBinary(detail.value.tesseract_binary);
    setPerCueTimeout(detail.value.per_cue_timeout_seconds);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "subtitle_ocr",
        payload: {
          enabled,
          batch_size: batchSize,
          interval_minutes: intervalMinutes,
          // ``subdir`` has no control — passed through so the full-replace
          // update preserves it.
          subdir: detail.value.subdir,
          languages,
          tesseract_binary: tesseractBinary.trim(),
          per_cue_timeout_seconds: perCueTimeout,
        },
      });
      onSuccess(t("admin.settings.subtitleOcr.snack.saved"));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={Captions}
      title={t("admin.settings.subtitleOcr.title")}
      subtitle={t("admin.settings.subtitleOcr.subtitle")}
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
        title={t("admin.settings.subtitleOcr.enabled.label")}
        helper={t("admin.settings.subtitleOcr.enabled.helper")}
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
        title={t("admin.settings.subtitleOcr.cadence.label")}
        helper={t("admin.settings.subtitleOcr.cadence.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.subtitleOcr.batchSize.label")}
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
            label={t("admin.settings.subtitleOcr.interval.label")}
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
        title={t("admin.settings.subtitleOcr.languages.label")}
        helper={t("admin.settings.subtitleOcr.languages.helper")}
      >
        <AdminInput
          label={t("admin.settings.subtitleOcr.languages.field")}
          value={languagesText}
          onChange={(e) => setLanguagesText(e.target.value)}
          placeholder="en, pt, fr"
          helperText={t("admin.settings.subtitleOcr.languages.hint")}
          sx={{ maxWidth: 520 }}
        />
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.subtitleOcr.engine.label")}
        helper={t("admin.settings.subtitleOcr.engine.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 520 }}>
          <AdminInput
            label={t("admin.settings.subtitleOcr.tesseractBinary.label")}
            value={tesseractBinary}
            onChange={(e) => setTesseractBinary(e.target.value)}
            error={!binaryValid}
            helperText={binaryValid ? undefined : t("admin.settings.errors.required")}
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.subtitleOcr.perCueTimeout.label")}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={perCueTimeout}
            onChange={(e) => setPerCueTimeout(Number(e.target.value))}
            error={!timeoutValid}
            helperText={
              !timeoutValid
                ? t("admin.settings.errors.minOne")
                : t("admin.settings.units.seconds")
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
