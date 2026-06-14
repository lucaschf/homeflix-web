import { Alert, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { UserCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { useUpdateAdminSetting } from "../../../api/hooks";
import type { AdminSettingDetail, AvatarSettings } from "../../../api/types";
import { AdminFormSection, AdminInput } from "../../../components/admin";
import { accentGold, status } from "../../../theme/tokens";
import { SettingsCardShell } from "./SettingsCardShell";

interface Props {
  detail: AdminSettingDetail & { value: AvatarSettings };
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Avatar bucket — upload size cap, output resolution, storage
 * subdirectory.
 *
 * The subdirectory is cached on the backend the first time it's
 * read by ``LocalAvatarStorage``; changing it via this form
 * propagates to new uploads but does **not** migrate existing files
 * — the operator has to move them manually after restart. We render
 * a persistent caveat alert at the top of the card so that's
 * unmissable.
 */
export function AvatarSettingsCard({ detail, onSuccess, onError }: Props) {
  const { t } = useTranslation();
  const update = useUpdateAdminSetting<AvatarSettings>();

  // Lazy init only; the parent remounts via ``key`` when
  // ``updated_at`` changes, so we never need a re-hydrate effect.
  const [storageSubdir, setStorageSubdir] = useState(detail.value.storage_subdir);
  const [maxSizeMb, setMaxSizeMb] = useState(detail.value.max_size_mb);
  const [sizePixels, setSizePixels] = useState(detail.value.size_pixels);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty =
    storageSubdir !== detail.value.storage_subdir ||
    maxSizeMb !== detail.value.max_size_mb ||
    sizePixels !== detail.value.size_pixels;

  const subdirValid = storageSubdir.trim().length >= 1;
  const sizeMbValid = Number.isFinite(maxSizeMb) && maxSizeMb >= 1 && maxSizeMb <= 20;
  const sizePxValid = Number.isFinite(sizePixels) && sizePixels >= 64 && sizePixels <= 1024;
  const canSave = dirty && subdirValid && sizeMbValid && sizePxValid;

  const onReset = () => {
    setStorageSubdir(detail.value.storage_subdir);
    setMaxSizeMb(detail.value.max_size_mb);
    setSizePixels(detail.value.size_pixels);
    setErrorMessage(null);
  };

  const onSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        key: "avatar",
        payload: {
          storage_subdir: storageSubdir.trim(),
          max_size_mb: maxSizeMb,
          size_pixels: sizePixels,
        },
      });
      onSuccess(t("admin.settings.avatar.snack.saved"));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.settings.snack.saveFailed");
      setErrorMessage(msg);
      onError(msg);
    }
  };

  const subdirChanged = storageSubdir !== detail.value.storage_subdir;

  return (
    <SettingsCardShell
      icon={UserCircle}
      title={t("admin.settings.avatar.title")}
      subtitle={t("admin.settings.avatar.subtitle")}
      source={detail.source}
      updatedAt={detail.updated_at}
      canSave={canSave}
      saving={update.isPending}
      onSave={onSave}
      onReset={onReset}
      errorMessage={errorMessage}
    >
      {subdirChanged && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{
            mb: 2,
            bgcolor: alpha(status.warn.base, 0.04),
            borderColor: alpha(status.warn.base, 0.30),
            color: "text.primary",
            "& .MuiAlert-icon": { color: accentGold },
          }}
        >
          {t("admin.settings.avatar.subdirMigrationWarning")}
        </Alert>
      )}

      <AdminFormSection
        title={t("admin.settings.avatar.storageSubdir.label")}
        helper={t("admin.settings.avatar.storageSubdir.helper")}
      >
        <Stack sx={{ maxWidth: 480 }}>
          <AdminInput
            mono
            value={storageSubdir}
            onChange={(e) => setStorageSubdir(e.target.value)}
            error={!subdirValid}
            helperText={!subdirValid ? t("admin.settings.errors.required") : undefined}
          />
        </Stack>
      </AdminFormSection>

      <AdminFormSection
        title={t("admin.settings.avatar.sizing.label")}
        helper={t("admin.settings.avatar.sizing.helper")}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 480 }}>
          <AdminInput
            label={t("admin.settings.avatar.maxSizeMb.label")}
            type="number"
            inputProps={{ min: 1, max: 20, step: 1 }}
            value={maxSizeMb}
            onChange={(e) => setMaxSizeMb(Number(e.target.value))}
            error={!sizeMbValid}
            helperText={
              !sizeMbValid ? t("admin.settings.errors.oneTo20") : "1 – 20 MB"
            }
            sx={{ flex: 1 }}
          />
          <AdminInput
            label={t("admin.settings.avatar.sizePixels.label")}
            type="number"
            inputProps={{ min: 64, max: 1024, step: 32 }}
            value={sizePixels}
            onChange={(e) => setSizePixels(Number(e.target.value))}
            error={!sizePxValid}
            helperText={
              !sizePxValid ? t("admin.settings.errors.sixtyFourTo1024") : "64 – 1024 px"
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </AdminFormSection>
    </SettingsCardShell>
  );
}
