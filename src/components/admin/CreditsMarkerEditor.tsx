import { DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  useClearCreditsMarker,
  useResetCreditsDetection,
  useSetCreditsMarker,
} from "../../api/hooks";
import type { CreditsMarkerOutput } from "../../api/types";
import { AdminBadge } from "./AdminBadge";
import { AdminButton } from "./AdminButton";
import { AdminDialog } from "./AdminDialog";
import { AdminInput } from "./AdminInput";

interface Props {
  /** Render only while ``true`` — the editor lazy-inits from props on mount. */
  open: boolean;
  onClose: () => void;
  /** Target media id (mov_xxx or epi_xxx). */
  mediaId: string;
  mediaTitle: string;
  /** Title duration (seconds) — upper bound for the onset. */
  durationSeconds: number;
  marker: CreditsMarkerOutput | null;
  /** Movie id to invalidate in cache (when editing a movie). */
  movieId?: string;
  /** Series id to invalidate in cache (when editing an episode). */
  seriesId?: string;
  /** Optional prefill, e.g. the player's current time. */
  suggestedSeconds?: number;
  onNotify?: (message: string, severity: "success" | "error") => void;
}

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Manual credits-marker editor (movies + episodes). Set the onset, clear
 * the marker, or requeue detection. Mounted only while ``open`` so the
 * onset seeds lazily from the existing marker / suggested time.
 */
export function CreditsMarkerEditor({
  open,
  onClose,
  mediaId,
  mediaTitle,
  durationSeconds,
  marker,
  movieId,
  seriesId,
  suggestedSeconds,
  onNotify,
}: Props) {
  const { t } = useTranslation();
  const setMarker = useSetCreditsMarker();
  const clearMarker = useClearCreditsMarker();
  const resetDetection = useResetCreditsDetection();

  const [onset, setOnset] = useState<number>(
    marker?.start_seconds ?? Math.floor(suggestedSeconds ?? 0),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cacheVars = { movieId, seriesId };
  const busy = setMarker.isPending || clearMarker.isPending || resetDetection.isPending;
  const onsetValid =
    Number.isFinite(onset) &&
    onset >= 0 &&
    (durationSeconds <= 0 || onset <= durationSeconds);

  const fail = (err: unknown) => {
    const msg = err instanceof ApiError ? err.message : t("admin.credits.editor.snack.failed");
    setErrorMessage(msg);
    onNotify?.(msg, "error");
  };

  const handleSave = async () => {
    if (!onsetValid || busy) return;
    setErrorMessage(null);
    try {
      await setMarker.mutateAsync({ mediaId, start_seconds: onset, ...cacheVars });
      onNotify?.(t("admin.credits.editor.snack.saved"), "success");
      onClose();
    } catch (err) {
      fail(err);
    }
  };

  const handleClear = async () => {
    if (busy) return;
    setErrorMessage(null);
    try {
      await clearMarker.mutateAsync({ mediaId, ...cacheVars });
      onNotify?.(t("admin.credits.editor.snack.cleared"), "success");
      onClose();
    } catch (err) {
      fail(err);
    }
  };

  const handleRedetect = async () => {
    if (busy) return;
    setErrorMessage(null);
    try {
      await resetDetection.mutateAsync({ mediaId, ...cacheVars });
      onNotify?.(t("admin.credits.editor.snack.requeued"), "success");
      onClose();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{t("admin.credits.editor.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {mediaTitle}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {t("admin.credits.editor.current")}:
            </Typography>
            {marker ? (
              <>
                <Typography variant="body2" fontWeight={600}>
                  {mmss(marker.start_seconds)}
                </Typography>
                <AdminBadge tone={marker.source === "MANUAL" ? "info" : "neutral"}>
                  {marker.source === "MANUAL"
                    ? t("admin.credits.source.manual")
                    : t("admin.credits.source.auto")}
                </AdminBadge>
                {marker.confidence != null && (
                  <Typography variant="caption" color="text.secondary">
                    {Math.round(marker.confidence * 100)}%
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("admin.credits.editor.none")}
              </Typography>
            )}
          </Stack>

          <AdminInput
            label={t("admin.credits.editor.onsetLabel")}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={onset}
            onChange={(e) => setOnset(Number(e.target.value))}
            error={!onsetValid}
            helperText={!onsetValid ? t("admin.credits.editor.errors.range") : mmss(onset)}
          />

          {suggestedSeconds != null && (
            <AdminButton
              variant="ghost"
              onClick={() => setOnset(Math.floor(suggestedSeconds))}
            >
              {t("admin.credits.editor.useCurrentTime", { time: mmss(suggestedSeconds) })}
            </AdminButton>
          )}

          {errorMessage && (
            <Typography variant="caption" color="error">
              {errorMessage}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
        <AdminButton variant="ghost" onClick={handleRedetect} disabled={busy}>
          {t("admin.credits.editor.redetect")}
        </AdminButton>
        {marker && (
          <AdminButton variant="danger" onClick={handleClear} disabled={busy}>
            {t("admin.credits.editor.clear")}
          </AdminButton>
        )}
        <div style={{ flex: 1 }} />
        <AdminButton variant="secondary" onClick={onClose} disabled={busy}>
          {t("admin.credits.editor.cancel")}
        </AdminButton>
        <AdminButton variant="primary" onClick={handleSave} disabled={busy || !onsetValid}>
          {t("admin.credits.editor.save")}
        </AdminButton>
      </DialogActions>
    </AdminDialog>
  );
}
