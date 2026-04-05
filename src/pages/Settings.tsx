import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { FolderOpen, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBulkEnrich, useHealth, useScan } from "../api/hooks";

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
  const [tmdbKey, setTmdbKey] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(true);

  const handleAddLibrary = useCallback((name: string, path: string) => {
    const newLib: Library = { id: `lib_${Date.now()}`, name, path };
    const updated = [...libraries, newLib];
    setLibraries(updated);
    saveLibraries(updated);
    setAddDialogOpen(false);
  }, [libraries]);

  const handleDeleteLibrary = useCallback((id: string) => {
    const updated = libraries.filter((l) => l.id !== id);
    setLibraries(updated);
    saveLibraries(updated);
  }, [libraries]);

  const handleScan = (lib: Library) => {
    scanMutation.mutate([lib.path]);
  };

  const handleScanAll = () => {
    const paths = libraries.map((l) => l.path);
    if (paths.length > 0) scanMutation.mutate(paths);
  };

  const apiHealthy = health?.status === "healthy";

  return (
    <Box sx={{ px: { xs: 3, md: 6 }, py: 4, maxWidth: 800 }}>
      <Typography variant="h1" sx={{ mb: 4 }}>
        {t("settings.title")}
      </Typography>

      {/* Libraries */}
      <SectionTitle>{t("settings.libraries")}</SectionTitle>
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {libraries.length > 0 ? (
            libraries.map((lib, idx) => (
              <Box key={lib.id}>
                {idx > 0 && <Divider />}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <FolderOpen size={20} color="#A0A0A0" />
                    <Box>
                      <Typography variant="body1" fontWeight={500}>{lib.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{lib.path}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<RefreshCw size={14} />}
                      onClick={() => handleScan(lib)}
                      disabled={scanMutation.isPending}
                    >
                      {scanMutation.isPending ? t("settings.scanning") : t("settings.scan")}
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteLibrary(lib.id)}
                      sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            ))
          ) : (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="body2" color="text.secondary">{t("settings.noLibraries")}</Typography>
            </Box>
          )}
          <Divider />
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
        </CardContent>
      </Card>

      {/* Playback */}
      <SectionTitle>{t("settings.playback")}</SectionTitle>
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.preferredAudio")}</InputLabel>
            <Select value={audioLang} onChange={(e) => setAudioLang(e.target.value)} label={t("settings.preferredAudio")}>
              <MenuItem value="pt-BR">Portugues (Brasil)</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="ja">Japanese</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t("settings.preferredSubtitle")}</InputLabel>
            <Select value={subtitleLang} onChange={(e) => setSubtitleLang(e.target.value)} label={t("settings.preferredSubtitle")}>
              <MenuItem value="pt-BR">Portugues (Brasil)</MenuItem>
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
        </CardContent>
      </Card>

      {/* Metadata */}
      <SectionTitle>{t("settings.metadata")}</SectionTitle>
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <TextField size="small" fullWidth label={t("settings.tmdbApiKey")} type="password" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} />
            <Button variant="outlined" size="small" sx={{ mt: 0.5, whiteSpace: "nowrap" }}>{t("settings.testKey")}</Button>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body2">{t("settings.autoEnrich")}</Typography>
            <Switch checked={autoEnrich} onChange={(_, checked) => setAutoEnrich(checked)} color="primary" />
          </Box>
          <Button
            variant="outlined"
            onClick={() => enrichMutation.mutate(false)}
            disabled={enrichMutation.isPending}
            fullWidth
          >
            {enrichMutation.isPending ? t("settings.enriching") : t("settings.enrichAll")}
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <SectionTitle>{t("settings.about")}</SectionTitle>
      <Card>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <DetailRow label={t("settings.version")} value="0.1.0" />
          <DetailRow
            label={t("settings.apiStatus")}
            value={
              <Chip
                label={apiHealthy ? t("settings.healthy") : t("settings.unreachable")}
                size="small"
                color={apiHealthy ? "success" : "error"}
                sx={{ height: 22 }}
              />
            }
          />
        </CardContent>
      </Card>

      {/* Add Library Dialog */}
      <AddLibraryDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddLibrary}
      />
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("settings.addLibraryTitle")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "16px !important" }}>
        <TextField
          autoFocus
          fullWidth
          label={t("settings.libraryName")}
          placeholder={t("settings.libraryNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          fullWidth
          label={t("settings.libraryPath")}
          placeholder={t("settings.libraryPathPlaceholder")}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          {t("settings.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!name.trim() || !path.trim()}>
          {t("settings.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Typography variant="h2" sx={{ mb: 1.5 }}>{children}</Typography>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {typeof value === "string" ? <Typography variant="body2">{value}</Typography> : value}
    </Box>
  );
}
