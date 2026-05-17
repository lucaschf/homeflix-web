import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { Folder, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreateLibrary,
  useDeleteLibrary,
  useLibrary,
  useUpdateLibrary,
} from "../../api/hooks";
import type { LibrarySettings } from "../../api/types";
import { ApiError } from "../../api/client";
import {
  AdminButton,
  AdminCard,
  AdminConfirmDialog,
  AdminFormSection,
  AdminInput,
  AdminPageHeader,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type LibraryType = "movies" | "series";
type SubtitleMode = "always" | "foreign" | "forced" | "none";
type Snack = { message: string; severity: "success" | "error" } | null;

const DEFAULT_SETTINGS: LibrarySettings = {
  preferred_audio_language: "en",
  preferred_subtitle_language: null,
  subtitle_mode: "none",
  generate_thumbnails: true,
  detect_intros: false,
  auto_refresh_metadata: false,
};

const LIBRARY_TYPE_OPTIONS: LibraryType[] = ["movies", "series"];
const SUBTITLE_MODE_OPTIONS: SubtitleMode[] = ["none", "always", "foreign", "forced"];

/**
 * Library create / edit. The same component handles both flows —
 * routing decides which: ``/admin/libraries/new`` boots an empty
 * form and calls ``useCreateLibrary`` on save; ``/admin/libraries/:id``
 * hydrates from ``useLibrary`` and calls ``useUpdateLibrary``.
 *
 * Sections (``AdminFormSection`` rows):
 *
 * 1. **Identity** — name + type + paths editor (add / remove rows).
 * 2. **Playback defaults** — preferred audio + subtitle language +
 *    subtitle mode (matches ``LibrarySettings`` shape).
 * 3. **Scan & automation** — cron schedule + 3 toggles
 *    (thumbnails, intro detection, auto-refresh metadata).
 * 4. **Danger zone** — soft-delete CTA (edit mode only).
 *
 * Metadata-provider editing is **not** in this page yet — adding
 * / removing / reordering providers needs a richer UI than this
 * PR can cleanly include. The existing providers stay round-tripped
 * across edits because the body sends only changed fields.
 */
export function LibraryDetailAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isCreate = !id || id === "new";

  const detail = useLibrary(isCreate ? undefined : id);
  const create = useCreateLibrary();
  const update = useUpdateLibrary();
  const remove = useDeleteLibrary();

  const [name, setName] = useState("");
  const [libraryType, setLibraryType] = useState<LibraryType>("movies");
  const [paths, setPaths] = useState<string[]>([""]);
  const [language, setLanguage] = useState("en");
  const [scanSchedule, setScanSchedule] = useState("");
  const [settings, setSettings] = useState<LibrarySettings>(DEFAULT_SETTINGS);

  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  useDocumentTitle(
    isCreate ? t("admin.libraries.detail.createTitle") : (detail.data?.name ?? "—"),
  );

  // Hydrate the form once the detail payload arrives. The effect
  // guards on the data identity (not on `detail.isSuccess`) so a
  // refetch of the same library doesn't blow away unsaved edits.
  useEffect(() => {
    if (isCreate || !detail.data) return;
    const lib = detail.data;
    setName(lib.name);
    setLibraryType((lib.library_type as LibraryType) ?? "movies");
    setPaths(lib.paths.length ? lib.paths : [""]);
    setLanguage(lib.language ?? "en");
    setScanSchedule(lib.scan_schedule ?? "");
    setSettings(lib.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data?.id]);

  const cleanedPaths = useMemo(
    () => paths.map((p) => p.trim()).filter((p) => p.length > 0),
    [paths],
  );
  const canSave = name.trim().length > 0 && cleanedPaths.length > 0;

  const onSave = async () => {
    if (!canSave) return;
    try {
      const body = {
        name: name.trim(),
        library_type: libraryType,
        paths: cleanedPaths,
        language: language.trim() || "en",
        scan_schedule: scanSchedule.trim() ? scanSchedule.trim() : null,
        settings,
      };
      if (isCreate) {
        const result = await create.mutateAsync(body);
        const newId = result.data.id;
        setSnack({
          message: t("admin.libraries.snack.created", { name: body.name }),
          severity: "success",
        });
        navigate(`/admin/libraries/${newId}`, { replace: true });
      } else {
        await update.mutateAsync({ id: id!, body });
        setSnack({
          message: t("admin.libraries.snack.updated", { name: body.name }),
          severity: "success",
        });
      }
    } catch (err) {
      setSnack({
        message:
          err instanceof ApiError ? err.message : t("admin.libraries.snack.saveFailed"),
        severity: "error",
      });
    }
  };

  const onConfirmDelete = async () => {
    if (isCreate || !id) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(id);
      navigate("/admin/libraries", { replace: true });
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : t("admin.libraries.snack.deleteFailed"),
      );
    }
  };

  if (!isCreate && detail.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!isCreate && detail.isError) {
    return (
      <Alert
        severity="error"
        action={
          <AdminButton variant="ghost" onClick={() => void detail.refetch()}>
            {t("admin.libraries.errorRetry")}
          </AdminButton>
        }
      >
        {t("admin.libraries.errorLoading")}
      </Alert>
    );
  }

  const headerSubtitle = isCreate
    ? t("admin.libraries.detail.createSubtitle")
    : detail.data
      ? `${detail.data.id} · ${
          detail.data.last_scan_at
            ? t("admin.libraries.detail.lastScan", {
                date: new Date(detail.data.last_scan_at).toLocaleDateString(),
              })
            : t("admin.libraries.detail.neverScanned")
        }`
      : undefined;

  const saving = create.isPending || update.isPending;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[
          t("admin.nav.group.catalog"),
          t("admin.nav.libraries"),
          isCreate ? t("admin.libraries.detail.createBreadcrumb") : (detail.data?.name ?? ""),
        ]}
        title={isCreate ? t("admin.libraries.detail.createTitle") : (detail.data?.name ?? "")}
        subtitle={headerSubtitle}
        primaryCTA={
          <Stack direction="row" spacing={1}>
            <AdminButton variant="ghost" onClick={() => navigate("/admin/libraries")}>
              {t("admin.libraries.detail.cancel")}
            </AdminButton>
            <AdminButton
              variant="primary"
              disabled={!canSave || saving}
              onClick={onSave}
            >
              {saving
                ? t("admin.libraries.detail.saving")
                : isCreate
                  ? t("admin.libraries.detail.createCta")
                  : t("admin.libraries.detail.saveCta")}
            </AdminButton>
          </Stack>
        }
      />

      <AdminCard>
        <AdminFormSection
          title={t("admin.libraries.detail.identity.title")}
          helper={t("admin.libraries.detail.identity.helper")}
        >
          <Stack spacing={2}>
            <AdminInput
              label={t("admin.libraries.detail.identity.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("admin.libraries.detail.identity.namePlaceholder")}
            />
            <Box>
              <Typography
                variant="eyebrow"
                component="label"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  letterSpacing: "0.14em",
                  fontSize: "0.625rem",
                  mb: 0.875,
                }}
              >
                {t("admin.libraries.detail.identity.type")}
              </Typography>
              <FormControl size="small">
                <Select<LibraryType>
                  value={libraryType}
                  onChange={(e) => setLibraryType(e.target.value as LibraryType)}
                  sx={{
                    fontSize: "0.875rem",
                    minWidth: 180,
                    bgcolor: "rgba(255,255,255,0.025)",
                  }}
                >
                  {LIBRARY_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt} sx={{ fontSize: "0.875rem" }}>
                      {t(`admin.libraries.detail.identity.typeOption.${opt}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <PathsEditor paths={paths} onChange={setPaths} />
          </Stack>
        </AdminFormSection>

        <AdminFormSection
          title={t("admin.libraries.detail.playback.title")}
          helper={t("admin.libraries.detail.playback.helper")}
        >
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <AdminInput
                label={t("admin.libraries.detail.playback.audioLang")}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                mono
                sx={{ flex: 1 }}
              />
              <AdminInput
                label={t("admin.libraries.detail.playback.subtitleLang")}
                value={settings.preferred_subtitle_language ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    preferred_subtitle_language: e.target.value || null,
                  }))
                }
                mono
                sx={{ flex: 1 }}
              />
            </Stack>
            <Box>
              <Typography
                variant="eyebrow"
                component="label"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  letterSpacing: "0.14em",
                  fontSize: "0.625rem",
                  mb: 0.875,
                }}
              >
                {t("admin.libraries.detail.playback.subtitleMode")}
              </Typography>
              <FormControl size="small">
                <Select<SubtitleMode>
                  value={(settings.subtitle_mode as SubtitleMode) ?? "none"}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      subtitle_mode: e.target.value as SubtitleMode,
                    }))
                  }
                  sx={{
                    fontSize: "0.875rem",
                    minWidth: 220,
                    bgcolor: "rgba(255,255,255,0.025)",
                  }}
                >
                  {SUBTITLE_MODE_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt} sx={{ fontSize: "0.875rem" }}>
                      {t(`admin.libraries.detail.playback.subtitleModeOption.${opt}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </AdminFormSection>

        <AdminFormSection
          title={t("admin.libraries.detail.scan.title")}
          helper={t("admin.libraries.detail.scan.helper")}
        >
          <Stack spacing={2}>
            <AdminInput
              label={t("admin.libraries.detail.scan.schedule")}
              value={scanSchedule}
              onChange={(e) => setScanSchedule(e.target.value)}
              placeholder={t("admin.libraries.detail.scan.schedulePlaceholder")}
              mono
            />
            <Stack spacing={0.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.generate_thumbnails}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, generate_thumbnails: e.target.checked }))
                    }
                  />
                }
                label={t("admin.libraries.detail.scan.toggle.thumbnails")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.detect_intros}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, detect_intros: e.target.checked }))
                    }
                  />
                }
                label={t("admin.libraries.detail.scan.toggle.detectIntros")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.auto_refresh_metadata}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, auto_refresh_metadata: e.target.checked }))
                    }
                  />
                }
                label={t("admin.libraries.detail.scan.toggle.autoRefresh")}
              />
            </Stack>
          </Stack>
        </AdminFormSection>

        {!isCreate && (
          <AdminFormSection
            title={t("admin.libraries.detail.danger.title")}
            helper={t("admin.libraries.detail.danger.helper")}
          >
            <Box>
              <AdminButton
                variant="danger"
                icon={<Trash2 size={15} />}
                onClick={() => setPendingDelete(true)}
              >
                {t("admin.libraries.detail.danger.cta")}
              </AdminButton>
            </Box>
          </AdminFormSection>
        )}
      </AdminCard>

      <AdminConfirmDialog
        open={pendingDelete}
        title={t("admin.libraries.delete.title", { name: detail.data?.name ?? "" })}
        body={t("admin.libraries.delete.body")}
        consequences={[
          t("admin.libraries.delete.consequenceUnindex"),
          t("admin.libraries.delete.consequenceFiles"),
          t("admin.libraries.delete.consequenceRefs"),
        ]}
        danger
        busy={remove.isPending}
        errorMessage={deleteError}
        onCancel={() => {
          setPendingDelete(false);
          setDeleteError(null);
        }}
        onConfirm={onConfirmDelete}
        confirmLabel={t("admin.libraries.delete.confirm")}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Box
            sx={{
              bgcolor:
                snack.severity === "success"
                  ? "rgba(80,180,120,0.15)"
                  : "rgba(220,80,70,0.18)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
          >
            {snack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}

interface PathsEditorProps {
  paths: string[];
  onChange: (next: string[]) => void;
}

function PathsEditor({ paths, onChange }: PathsEditorProps) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <Typography
        variant="eyebrow"
        sx={{
          color: "text.secondary",
          letterSpacing: "0.14em",
          fontSize: "0.625rem",
        }}
      >
        {t("admin.libraries.detail.identity.paths")}
      </Typography>
      {paths.map((path, idx) => (
        <Stack key={idx} direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: "text.secondary", display: "flex", flexShrink: 0 }}>
            <Folder size={15} aria-hidden />
          </Box>
          <AdminInput
            value={path}
            onChange={(e) => {
              const next = [...paths];
              next[idx] = e.target.value;
              onChange(next);
            }}
            placeholder={t("admin.libraries.detail.identity.pathPlaceholder")}
            mono
            sx={{ flex: 1 }}
          />
          <IconButton
            size="small"
            onClick={() => {
              const next = paths.filter((_, i) => i !== idx);
              onChange(next.length ? next : [""]);
            }}
            disabled={paths.length === 1 && !path.trim()}
            sx={{ color: "#ff8a7a" }}
            aria-label={t("admin.libraries.detail.identity.removePath")}
          >
            <Trash2 size={14} />
          </IconButton>
        </Stack>
      ))}
      <Box>
        <AdminButton
          variant="ghost"
          icon={<Plus size={14} />}
          onClick={() => onChange([...paths, ""])}
        >
          {t("admin.libraries.detail.identity.addPath")}
        </AdminButton>
      </Box>
    </Stack>
  );
}
