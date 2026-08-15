import { DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useDefineFileSegments } from "../../api/hooks";
import type { FileSegmentInput, SeasonOutput } from "../../api/types";
import { AdminButton } from "./AdminButton";
import { AdminDialog } from "./AdminDialog";
import { AdminInput } from "./AdminInput";

interface Props {
  /** Render only while ``true`` — the editor lazy-inits from props on mount. */
  open: boolean;
  onClose: () => void;
  /** External series id (ser_xxx). */
  seriesId: string;
  /** The season whose episodes share one physical file. */
  season: SeasonOutput;
  onNotify?: (message: string, severity: "success" | "error") => void;
}

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

interface Row {
  episodeNumber: number;
  title: string;
  start: number;
  end: number;
}

/**
 * Admin editor for multi-episode files (ADR-030): declare the ``[start, end)``
 * window each episode occupies inside one shared physical file. Every episode
 * of the season gets a row, pre-filled from any existing segment. On save the
 * backend attaches a segmented file variant to each episode so it streams just
 * its range — no on-disk splitting.
 */
export function FileSegmentsEditor({ open, onClose, seriesId, season, onNotify }: Props) {
  const { t } = useTranslation();
  const define = useDefineFileSegments();

  // Episodes of the season already share the physical file, so seed the path
  // from the first episode that has one.
  const [filePath, setFilePath] = useState<string>(
    () => season.episodes.find((e) => e.file_path)?.file_path ?? "",
  );
  const [rows, setRows] = useState<Row[]>(() =>
    season.episodes.map((e) => ({
      episodeNumber: e.episode_number,
      title: e.title,
      start: e.segment_start_seconds ?? 0,
      end: e.segment_end_seconds ?? 0,
    })),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const patchRow = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  // A row counts as "to assign" only once it has a real window; rows left at
  // 0/0 are simply skipped (that episode keeps whatever file it had).
  const filled = rows.filter((r) => r.end > r.start);
  const anyInvalid = rows.some((r) => r.end !== 0 && r.end <= r.start);
  const canSubmit =
    filePath.trim().length > 0 && filled.length > 0 && !anyInvalid && !define.isPending;

  const handleSave = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    const segments: FileSegmentInput[] = filled.map((r) => ({
      episode_number: r.episodeNumber,
      start_seconds: r.start,
      end_seconds: r.end,
    }));
    try {
      await define.mutateAsync({
        seriesId,
        season_number: season.season_number,
        file_path: filePath.trim(),
        segments,
      });
      onNotify?.(t("admin.segments.snack.saved", { count: filled.length }), "success");
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("admin.segments.errors.failed");
      setErrorMessage(msg);
      onNotify?.(msg, "error");
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{t("admin.segments.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("admin.segments.subtitle")}
          </Typography>

          <AdminInput
            label={t("admin.segments.filePath")}
            mono
            placeholder="G:/homeflix/.../whole.mkv"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            error={filePath.trim().length === 0}
            helperText={t("admin.segments.filePathHelp")}
          />

          <Stack spacing={2}>
            {rows.map((row, index) => {
              const rowInvalid = row.end !== 0 && row.end <= row.start;
              return (
                <Stack
                  key={row.episodeNumber}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ sm: "flex-start" }}
                >
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 140, pt: { sm: 1 }, fontWeight: 600 }}
                    noWrap
                  >
                    {t("admin.segments.episodeLabel", {
                      number: row.episodeNumber,
                    })}
                    <Typography component="span" color="text.secondary" fontWeight={400}>
                      {" · "}
                      {row.title}
                    </Typography>
                  </Typography>
                  <AdminInput
                    label={t("admin.segments.start")}
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={row.start}
                    onChange={(e) => patchRow(index, { start: Number(e.target.value) })}
                    error={rowInvalid}
                    helperText={mmss(row.start)}
                    sx={{ width: { sm: 150 } }}
                  />
                  <AdminInput
                    label={t("admin.segments.end")}
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={row.end}
                    onChange={(e) => patchRow(index, { end: Number(e.target.value) })}
                    error={rowInvalid}
                    helperText={rowInvalid ? t("admin.segments.errors.range") : mmss(row.end)}
                    sx={{ width: { sm: 150 } }}
                  />
                </Stack>
              );
            })}
          </Stack>

          {errorMessage && (
            <Typography variant="caption" color="error">
              {errorMessage}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <AdminButton variant="secondary" onClick={onClose} disabled={define.isPending}>
          {t("admin.segments.cancel")}
        </AdminButton>
        <AdminButton variant="primary" onClick={handleSave} disabled={!canSubmit}>
          {define.isPending ? t("admin.segments.saving") : t("admin.segments.save")}
        </AdminButton>
      </DialogActions>
    </AdminDialog>
  );
}
