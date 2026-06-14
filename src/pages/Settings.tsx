import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { Info, MonitorPlay } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHealth } from "../api/hooks";
import { LanguageSwitch } from "../components/language-switch/LanguageSwitch";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  usePlaybackPreferences,
  type SubtitleMode,
} from "../hooks/usePlaybackPreferences";
import { neutral } from "../theme/colors";
import { whiteAlpha } from "../theme/tokens";

/**
 * Per-profile settings page surfaced under ``/settings``.
 *
 * Scoped to the things a household member can actually change for
 * themselves: playback preferences (audio / subtitle language,
 * default quality, subtitle mode) and a small About panel with the
 * app version + API health + language picker. Library / metadata
 * administration now lives exclusively under ``/admin`` so the
 * admin and member surfaces don't duplicate the same actions
 * (overlap had drifted apart and was a footgun — "scan all from
 * Settings" used the simpler endpoint while ``/admin/scan`` had
 * the richer run history). Settings is now an everyone-page.
 */
export function Settings() {
  const { t } = useTranslation();
  useDocumentTitle(t("settings.title"));
  const { data: health } = useHealth();
  // Playback preferences are persisted to localStorage via this
  // hook and consumed by the Player on first play of a new media.
  // The partial-update setter lets each Select be a one-liner.
  const [playbackPrefs, setPlaybackPrefs] = usePlaybackPreferences();

  const apiHealthy = health?.status === "healthy";

  return (
    <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 3, md: 5 }, maxWidth: 800, mx: "auto" }}>
      <Typography
        variant="h1"
        sx={{ fontSize: { xs: "1.5rem", md: "1.75rem" }, fontWeight: 700, mb: 4 }}
      >
        {t("settings.title")}
      </Typography>

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

      {/* ── About ────────────────────────────────────────── */}
      <SettingsSection icon={Info} title={t("settings.about")} last>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2.5 }}>
          <SettingsRow label={t("settings.version")}>
            <Typography variant="body2" fontWeight={500}>
              0.1.0
            </Typography>
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
        <Icon size={18} color={neutral[400]} />
        <Typography variant="h2" sx={{ fontSize: "1.1rem", fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          bgcolor: whiteAlpha(0.03),
          borderRadius: 2,
          border: `1px solid ${whiteAlpha(0.06)}`,
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
