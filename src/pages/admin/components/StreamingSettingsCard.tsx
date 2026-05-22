import { FormControlLabel, Stack, Switch } from "@mui/material";
import { Cpu } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type { AdminSettingDetail, StreamingSettings } from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { SettingsCardShell } from "./SettingsCardShell";

interface Props {
  detail: AdminSettingDetail & { value: StreamingSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const DEFAULT_THREADS_CAP = 4;

/**
 * Streaming bucket — ffmpeg thread cap + HLS cache size cap.
 *
 * ``ffmpeg_threads`` is nullable: ``null`` means "auto" (ffmpeg picks
 * every logical core). The form exposes this via a toggle + number
 * input pair so the operator can flip back to auto without typing a
 * sentinel value.
 *
 * ``hls_cache_max_size_mb=0`` disables eviction entirely (cache grows
 * unbounded). Highlighted in the helper text to make the consequence
 * unmissable.
 */
export function StreamingSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<StreamingSettings>();

  // Lazy init only; the parent remounts via ``key`` when
  // ``updated_at`` changes, so we never need a re-hydrate effect.
  const [threadsCapped, setThreadsCapped] = useState(detail.value.ffmpeg_threads !== null);
  const [ffmpegThreads, setFfmpegThreads] = useState(
    detail.value.ffmpeg_threads ?? DEFAULT_THREADS_CAP,
  );
  const [maxCacheMb, setMaxCacheMb] = useState(detail.value.hls_cache_max_size_mb);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const persistedCapped = detail.value.ffmpeg_threads !== null;
  const persistedThreads = detail.value.ffmpeg_threads ?? DEFAULT_THREADS_CAP;
  const threadsDirty =
    threadsCapped !== persistedCapped ||
    (threadsCapped && ffmpegThreads !== persistedThreads);
  const cacheDirty = maxCacheMb !== detail.value.hls_cache_max_size_mb;
  const dirty = threadsDirty || cacheDirty;

  const threadsValid = !threadsCapped || (Number.isFinite(ffmpegThreads) && ffmpegThreads >= 1);
  const cacheValid = Number.isFinite(maxCacheMb) && maxCacheMb >= 0;
  const canSave = dirty && threadsValid && cacheValid;

  const onReset = () => {
    setThreadsCapped(persistedCapped);
    setFfmpegThreads(persistedThreads);
    setMaxCacheMb(detail.value.hls_cache_max_size_mb);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "streaming",
        payload: {
          ffmpeg_threads: threadsCapped ? ffmpegThreads : null,
          hls_cache_max_size_mb: maxCacheMb,
        },
      });
      onSuccess(t("admin.settings.streaming.snack.saved"));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  return (
    <SettingsCardShell
      icon={Cpu}
      title={t("admin.settings.streaming.title")}
      subtitle={t("admin.settings.streaming.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      <AdminFormSection
        title={t("admin.settings.streaming.threads.label")}
        helper={t("admin.settings.streaming.threads.helper")}
      >
        <Stack spacing={2} sx={{ maxWidth: 320 }}>
          <FormControlLabel
            control={
              <Switch
                checked={threadsCapped}
                onChange={(_e, checked) => setThreadsCapped(checked)}
                color="primary"
              />
            }
            label={
              threadsCapped
                ? t("admin.settings.streaming.threads.capOn")
                : t("admin.settings.streaming.threads.capOff")
            }
          />
          {threadsCapped && (
            <AdminInput
              type="number"
              inputProps={{ min: 1, step: 1 }}
              value={ffmpegThreads}
              onChange={(e) => setFfmpegThreads(Number(e.target.value))}
              error={!threadsValid}
              helperText={
                !threadsValid
                  ? t("admin.settings.errors.minOne")
                  : t("admin.settings.units.threads")
              }
            />
          )}
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.streaming.cacheCap.label")}
        helper={t("admin.settings.streaming.cacheCap.helper")}
      >
        <Stack sx={{ maxWidth: 240 }}>
          <AdminInput
            type="number"
            inputProps={{ min: 0, step: 256 }}
            value={maxCacheMb}
            onChange={(e) => setMaxCacheMb(Number(e.target.value))}
            error={!cacheValid}
            helperText={
              !cacheValid
                ? t("admin.settings.errors.minZero")
                : maxCacheMb === 0
                  ? t("admin.settings.streaming.cacheCap.unlimited")
                  : t("admin.settings.units.megabytes")
            }
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
