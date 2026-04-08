import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  Database,
  FolderOpen,
  HardDrive,
  Info,
  MonitorPlay,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBulkEnrich, useHealth, useScan } from "../api/hooks";
import { LanguageSwitch } from "../components/language-switch/LanguageSwitch";

const LIBRARIES_STORAGE_KEY = "homeflix-libraries";

interface Library {
  id: string;
  name: string;
  path: string;
}

function loadLibraries(): Library[] {
  try {
    return JSON.parse(localStorage.getItem(LIBRARIES_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLibraries(libs: Library[]) {
  localStorage.setItem(LIBRARIES_STORAGE_KEY, JSON.stringify(libs));
}

export function Settings() {
  const { t } = useTranslation();
  const [libraries, setLibraries] = useState<Library[]>(loadLibraries);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const scanMutation = useScan();
  const enrichMutation = useBulkEnrich();
  const { data: health } = useHealth();

  const [audioLang, setAudioLang] = useState("pt-BR");
  const [subtitleLang, setSubtitleLang] = useState("pt-BR");
  const [subtitleMode, setSubtitleMode] = useState("foreignOnly");
  const [defaultQuality, setDefaultQuality] = useState("best");
  const [autoEnrich, setAutoEnrich] = useState(true);

  const handleAddLibrary = useCallback(
    (name: string, path: string) => {
      const newLib: Library = { id: `lib_${Date.now()}`, name, path };
      const updated = [...libraries, newLib];
      setLibraries(updated);
      saveLibraries(updated);
      setAddDialogOpen(false);
    },
    [libraries],
  );

  const handleDeleteLibrary = useCallback(
    (id: string) => {
      const updated = libraries.filter((l) => l.id !== id);
      setLibraries(updated);
      saveLibraries(updated);
    },
    [libraries],
  );

  const handleScan = (lib: Library) => {
    scanMutation.mutate([lib.path]);
  };

  const handleScanAll = () => {
    const paths = libraries.map((l) => l.path);
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
        {libraries.length > 0 ? (
          libraries.map((lib, idx) => (
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
                  <FolderOpen size={18} color="#A0A0A0" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {lib.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {lib.path}
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
            <FolderOpen size={32} color="#555" />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("settings.noLibraries")}
            </Typography>
          </Box>
        )}
        <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", px: 2.5, py: 1.5 }}>
          <Button startIcon={<Plus size={16} />} size="small" onClick={() => setAddDialogOpen(true)}>
            {t("settings.addLibrary")}
          </Button>
          {libraries.length > 0 && (
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
            <Select value={audioLang} onChange={(e) => setAudioLang(e.target.value)} label={t("settings.preferredAudio")}>
              <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="ja">日本語</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.preferredSubtitle")}</InputLabel>
            <Select value={subtitleLang} onChange={(e) => setSubtitleLang(e.target.value)} label={t("settings.preferredSubtitle")}>
              <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="off">{t("settings.subtitleModes.off")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.subtitleMode")}</InputLabel>
            <Select value={subtitleMode} onChange={(e) => setSubtitleMode(e.target.value)} label={t("settings.subtitleMode")}>
              <MenuItem value="always">{t("settings.subtitleModes.always")}</MenuItem>
              <MenuItem value="foreignOnly">{t("settings.subtitleModes.foreignOnly")}</MenuItem>
              <MenuItem value="forcedOnly">{t("settings.subtitleModes.forcedOnly")}</MenuItem>
              <MenuItem value="off">{t("settings.subtitleModes.off")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.defaultQuality")}</InputLabel>
            <Select value={defaultQuality} onChange={(e) => setDefaultQuality(e.target.value)} label={t("settings.defaultQuality")}>
              <MenuItem value="best">{t("settings.qualityOptions.best")}</MenuItem>
              <MenuItem value="1080p">{t("settings.qualityOptions.1080p")}</MenuItem>
              <MenuItem value="720p">{t("settings.qualityOptions.720p")}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </SettingsSection>

      {/* ── Metadata ─────────────────────────────────────── */}
      <SettingsSection icon={Database} title={t("settings.metadata")}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 2.5 }}>
          <SettingsRow label={t("settings.autoEnrich")}>
            <Switch checked={autoEnrich} onChange={(_, checked) => setAutoEnrich(checked)} color="primary" size="small" />
          </SettingsRow>
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
              sx={{ height: 22, fontWeight: 600 }}
            />
          </SettingsRow>
          <SettingsRow label={t("settings.language")}>
            <LanguageSwitch />
          </SettingsRow>
        </Box>
      </SettingsSection>

      {/* Add Library Dialog */}
      <AddLibraryDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddLibrary}
      />
    </Box>
  );
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
        <Icon size={18} color="#888" />
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

function AddLibraryDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, path: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const handleSubmit = () => {
    if (name.trim() && path.trim()) {
      onAdd(name.trim(), path.trim());
      setName("");
      setPath("");
    }
  };

  const handleClose = () => {
    setName("");
    setPath("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
      <DialogTitle sx={{ fontWeight: 600 }}>{t("settings.addLibraryTitle")}</DialogTitle>
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
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          size="small"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} color="inherit" size="small">
          {t("settings.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!name.trim() || !path.trim()} size="small">
          {t("settings.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
