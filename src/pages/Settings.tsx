import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  Database,
  FolderOpen,
  HardDrive,
  Info,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useBulkEnrich,
  useCreateLibrary,
  useDeleteLibrary,
  useHealth,
  useLibraries,
  useScan,
  useUpdateLibrary,
} from "../api/hooks";
import type { Library } from "../api/types";
import { LanguageSwitch } from "../components/language-switch/LanguageSwitch";
import { neutral } from "../theme/colors";
import {
  usePlaybackPreferences,
  type SubtitleMode,
} from "../hooks/usePlaybackPreferences";
import {
  CUSTOM_SENTINEL,
  SCHEDULE_PRESETS,
  describeCron,
  formatRelativeTime,
  isPlausibleCron,
  matchPreset,
  type PresetKey,
} from "../utils/schedule";

// Key used by the old localStorage-only implementation. Checked
// once on mount for a one-shot migration to the backend, then
// removed so the migration never re-runs.
const LEGACY_LIBRARIES_KEY = "homeflix-libraries";

export function Settings() {
  const { t, i18n } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
  const scanMutation = useScan();
  const enrichMutation = useBulkEnrich();
  const { data: health } = useHealth();

  // ── Libraries (backend-backed) ──────────────────────────
  const { data: libraries, isLoading: librariesLoading } = useLibraries();
  const createLibrary = useCreateLibrary();
  const updateLibrary = useUpdateLibrary();
  const deleteLibrary = useDeleteLibrary();

  // One-shot migration: if the user had libraries in localStorage
  // (from before this integration), push them to the backend the
  // first time the query resolves empty, then clear localStorage
  // so the migration never re-fires.
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (librariesLoading || migrationDoneRef.current) return;
    if ((libraries?.length ?? 0) > 0) {
      // Backend already has libraries — no migration needed.
      localStorage.removeItem(LEGACY_LIBRARIES_KEY);
      migrationDoneRef.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(LEGACY_LIBRARIES_KEY);
      if (!raw) { migrationDoneRef.current = true; return; }
      const legacy: { name: string; path: string }[] = JSON.parse(raw);
      if (!Array.isArray(legacy) || legacy.length === 0) {
        migrationDoneRef.current = true;
        return;
      }
      migrationDoneRef.current = true;
      // Fire-and-forget — each create invalidates the query, so the
      // UI will progressively populate as responses land.
      for (const lib of legacy) {
        createLibrary.mutate({
          name: lib.name,
          library_type: "mixed",
          paths: [lib.path],
          scan_schedule: null,
        });
      }
      localStorage.removeItem(LEGACY_LIBRARIES_KEY);
    } catch {
      migrationDoneRef.current = true;
    }
  }, [libraries, librariesLoading, createLibrary]);

  // Playback preferences are persisted to localStorage via this
  // hook and consumed by the Player on first play of a new media.
  // The partial-update setter lets each Select be a one-liner.
  const [playbackPrefs, setPlaybackPrefs] = usePlaybackPreferences();

  const handleOpenCreate = useCallback(() => {
    setEditingLibrary(null);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((lib: Library) => {
    setEditingLibrary(lib);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleSubmitLibrary = useCallback(
    (body: {
      name: string;
      path: string;
      scan_schedule: string | null;
    }) => {
      if (editingLibrary) {
        updateLibrary.mutate({
          id: editingLibrary.id,
          body: {
            name: body.name,
            paths: [body.path],
            scan_schedule: body.scan_schedule,
          },
        });
      } else {
        createLibrary.mutate({
          name: body.name,
          library_type: "mixed",
          paths: [body.path],
          scan_schedule: body.scan_schedule,
        });
      }
      setDialogOpen(false);
    },
    [editingLibrary, createLibrary, updateLibrary],
  );

  const handleDeleteLibrary = useCallback(
    (id: string) => {
      deleteLibrary.mutate(id);
    },
    [deleteLibrary],
  );

  const handleScan = (lib: Library) => {
    scanMutation.mutate(lib.paths);
  };

  const handleScanAll = () => {
    const paths = (libraries ?? []).flatMap((l) => l.paths);
    if (paths.length > 0) scanMutation.mutate(paths);
  };

  const apiHealthy = health?.status === "healthy";

  return (
    <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 3, md: 5 }, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", md: "1.75rem" }, fontWeight: 700, mb: 4 }}>
        {t("settings.title")}
      </Typography>

      {/* ── Libraries ────────────────────────────────────── */}
      <SettingsSection icon={HardDrive} title={t("settings.libraries")}>
        {librariesLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (libraries ?? []).length > 0 ? (
          (libraries ?? []).map((lib, idx) => (
            <Box key={lib.id}>
              {idx > 0 && <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 2.5,
                  py: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                  <FolderOpen size={18} color={neutral[400]} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap title={lib.name}>
                      {lib.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} title={lib.paths.join(", ")}>
                      {lib.paths.join(", ")}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      title={
                        lib.last_scan_at
                          ? new Date(lib.last_scan_at).toLocaleString(i18n.language)
                          : undefined
                      }
                      sx={{ display: "block", opacity: 0.7, fontSize: "0.7rem" }}
                    >
                      {formatLibraryStatus(lib, i18n.language, t)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                  <Button
                    size="small"
                    startIcon={<RefreshCw size={14} />}
                    onClick={() => handleScan(lib)}
                    disabled={scanMutation.isPending}
                    sx={{ fontSize: "0.75rem" }}
                  >
                    {scanMutation.isPending ? t("settings.scanning") : t("settings.scan")}
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenEdit(lib)}
                    title={t("settings.editLibrary")}
                    sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                  >
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteLibrary(lib.id)}
                    sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          ))
        ) : (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <FolderOpen size={32} color={neutral[600]} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("settings.noLibraries")}
            </Typography>
          </Box>
        )}
        <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", px: 2.5, py: 1.5 }}>
          <Button startIcon={<Plus size={16} />} size="small" onClick={handleOpenCreate}>
            {t("settings.addLibrary")}
          </Button>
          {(libraries ?? []).length > 0 && (
            <Button
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={handleScanAll}
              disabled={scanMutation.isPending}
            >
              {scanMutation.isPending ? t("settings.scanning") : `${t("settings.scan")} ${t("browse.all")}`}
            </Button>
          )}
        </Box>
      </SettingsSection>

      {/* ── Playback ─────────────────────────────────────── */}
      <SettingsSection icon={MonitorPlay} title={t("settings.playback")}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 2.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.preferredAudio")}</InputLabel>
            <Select
              value={playbackPrefs.audioLang}
              onChange={(e) => setPlaybackPrefs({ audioLang: e.target.value })}
              label={t("settings.preferredAudio")}
            >
              <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="ja">日本語</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.preferredSubtitle")}</InputLabel>
            <Select
              value={playbackPrefs.subtitleLang}
              onChange={(e) => setPlaybackPrefs({ subtitleLang: e.target.value })}
              label={t("settings.preferredSubtitle")}
            >
              <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="off">{t("settings.subtitleModes.off")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.subtitleMode")}</InputLabel>
            <Select
              value={playbackPrefs.subtitleMode}
              onChange={(e) =>
                setPlaybackPrefs({ subtitleMode: e.target.value as SubtitleMode })
              }
              label={t("settings.subtitleMode")}
            >
              <MenuItem value="always">{t("settings.subtitleModes.always")}</MenuItem>
              <MenuItem value="foreignOnly">{t("settings.subtitleModes.foreignOnly")}</MenuItem>
              <MenuItem value="forcedOnly">{t("settings.subtitleModes.forcedOnly")}</MenuItem>
              <MenuItem value="off">{t("settings.subtitleModes.off")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.defaultQuality")}</InputLabel>
            <Select
              value={playbackPrefs.defaultQuality}
              onChange={(e) => setPlaybackPrefs({ defaultQuality: e.target.value })}
              label={t("settings.defaultQuality")}
            >
              <MenuItem value="best">{t("settings.qualityOptions.best")}</MenuItem>
              <MenuItem value="1080p">{t("settings.qualityOptions.1080p")}</MenuItem>
              <MenuItem value="720p">{t("settings.qualityOptions.720p")}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </SettingsSection>

      {/* ── Metadata ─────────────────────────────────────── */}
      {/* The old "auto-enrich on scan" toggle was removed — every
          scan now enriches automatically so exposing a switch that
          defaulted to on and only affected an unused state hook
          was pure friction. Manual re-enrich stays available for
          one-shot refreshes of the whole catalog. */}
      <SettingsSection icon={Database} title={t("settings.metadata")}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 2.5 }}>
          <Button
            variant="outlined"
            onClick={() => enrichMutation.mutate(false)}
            disabled={enrichMutation.isPending}
            fullWidth
            sx={{ borderColor: "rgba(255,255,255,0.15)" }}
          >
            {enrichMutation.isPending ? t("settings.enriching") : t("settings.enrichAll")}
          </Button>
        </Box>
      </SettingsSection>

      {/* ── About ────────────────────────────────────────── */}
      <SettingsSection icon={Info} title={t("settings.about")} last>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2.5 }}>
          <SettingsRow label={t("settings.version")}>
            <Typography variant="body2" fontWeight={500}>0.1.0</Typography>
          </SettingsRow>
          <SettingsRow label={t("settings.apiStatus")}>
            <Chip
              label={apiHealthy ? t("settings.healthy") : t("settings.unreachable")}
              size="small"
              color={apiHealthy ? "success" : "error"}
              variant="outlined"
              sx={{ height: 22, fontWeight: 600 }}
            />
          </SettingsRow>
          <SettingsRow label={t("settings.language")}>
            <LanguageSwitch />
          </SettingsRow>
        </Box>
      </SettingsSection>

      {/* Create / Edit Library Dialog.
          The `key` forces a remount whenever the target library changes,
          so internal form state resets cleanly — no setState-in-effect. */}
      <LibraryDialog
        key={editingLibrary?.id ?? "create"}
        open={dialogOpen}
        library={editingLibrary}
        onClose={handleCloseDialog}
        onSubmit={handleSubmitLibrary}
      />
    </Box>
  );
}

/**
 * Build the "Last scanned … · every hour" status line for a library.
 * Omits the schedule suffix when no schedule is set.
 */
function formatLibraryStatus(
  lib: Library,
  locale: string,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  const when = lib.last_scan_at
    ? t("settings.lastScannedAt", {
        when: formatRelativeTime(lib.last_scan_at, locale, t as never),
      })
    : t("settings.neverScanned");
  const sched = describeCron(lib.scan_schedule, t as never);
  return sched ? `${when} · ${sched.toLowerCase()}` : when;
}

// ── Shared Components ──────────────────────────────────────────────

function SettingsSection({
  icon: Icon,
  title,
  children,
  last = false,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Box sx={{ mb: last ? 0 : 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Icon size={18} color={neutral[400]} />
        <Typography variant="h2" sx={{ fontSize: "1.1rem", fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          bgcolor: "rgba(255,255,255,0.03)",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Box>
  );
}

interface LibraryDialogSubmit {
  name: string;
  path: string;
  scan_schedule: string | null;
}

/**
 * Create/edit dialog for libraries.
 *
 * When ``library`` is null, behaves as a create form. Otherwise it
 * pre-fills from the given library and switches copy + submit handler
 * to the edit path. The caller decides which mutation to fire.
 */
function LibraryDialog({
  open,
  library,
  onClose,
  onSubmit,
}: {
  open: boolean;
  library: Library | null;
  onClose: () => void;
  onSubmit: (body: LibraryDialogSubmit) => void;
}) {
  const { t } = useTranslation();
  const isEdit = library !== null;

  // Derive the initial values once per mount — the parent rekeys this
  // component when the target library changes, so useState initializers
  // are the correct place to read from props.
  const savedPreset = library ? matchPreset(library.scan_schedule) : "never";
  const [name, setName] = useState(library?.name ?? "");
  const [path, setPath] = useState(library?.paths[0] ?? "");
  const [preset, setPreset] = useState<PresetKey>(savedPreset);
  const [customCron, setCustomCron] = useState(
    savedPreset === CUSTOM_SENTINEL ? (library?.scan_schedule ?? "") : "",
  );

  const cronInvalid =
    preset === CUSTOM_SENTINEL &&
    customCron.trim().length > 0 &&
    !isPlausibleCron(customCron);

  const canSubmit =
    name.trim().length > 0 &&
    path.trim().length > 0 &&
    (preset !== CUSTOM_SENTINEL || (customCron.trim().length > 0 && !cronInvalid));

  const resolveSchedule = (): string | null => {
    if (preset === CUSTOM_SENTINEL) {
      return customCron.trim() || null;
    }
    const hit = SCHEDULE_PRESETS.find((p) => p.key === preset);
    return hit?.cron ?? null;
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      path: path.trim(),
      scan_schedule: resolveSchedule(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.paper",
            borderRadius: 2,
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>
        {isEdit ? t("settings.editLibraryTitle") : t("settings.addLibraryTitle")}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "16px !important" }}>
        <TextField
          autoFocus
          fullWidth
          label={t("settings.libraryName")}
          placeholder={t("settings.libraryNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
        />
        <TextField
          fullWidth
          label={t("settings.libraryPath")}
          placeholder={t("settings.libraryPathPlaceholder")}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          size="small"
        />
        <FormControl size="small" fullWidth>
          <InputLabel>{t("settings.schedule")}</InputLabel>
          <Select
            value={preset}
            label={t("settings.schedule")}
            onChange={(e) => setPreset(e.target.value as PresetKey)}
          >
            {SCHEDULE_PRESETS.map((p) => (
              <MenuItem key={p.key} value={p.key}>
                {t(p.labelKey)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {preset === CUSTOM_SENTINEL && (
          <FormControl error={cronInvalid} fullWidth>
            <TextField
              fullWidth
              label={t("settings.scheduleCustomLabel")}
              placeholder="0 3 * * *"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              size="small"
              error={cronInvalid}
            />
            <FormHelperText>
              {cronInvalid
                ? t("settings.scheduleCustomInvalid")
                : t("settings.scheduleCustomHelp")}
            </FormHelperText>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit" size="small">
          {t("settings.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!canSubmit} size="small">
          {isEdit ? t("settings.save") : t("settings.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
