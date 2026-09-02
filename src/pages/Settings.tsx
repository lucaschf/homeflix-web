import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Switch,
  Typography,
} from "@mui/material";
import { Bookmark, Film, Play } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useHealth } from "../api/hooks";
import { SegmentedControl, type SegmentedOption } from "../components/admin/SegmentedControl";
import { LanguageSwitch } from "../components/language-switch/LanguageSwitch";
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsGroupLabel,
  SettingsRow,
  SettingsSectionHead,
  SubtitleColorSwatches,
  SubtitlePreview,
  ThemeSwatchGrid,
} from "../components/settings";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  CREDITS_SKIP_MODES,
  DEFAULT_SUBTITLE_APPEARANCE,
  INTRO_SKIP_MODES,
  SUBTITLE_FONT_SIZES,
  SUBTITLE_MODES,
  SUBTITLE_TEXT_EDGES,
  usePlaybackPreferences,
  type CreditsSkipMode,
  type IntroSkipMode,
  type SubtitleAppearance,
  type SubtitleFontSize,
  type SubtitleMode,
  type SubtitleTextEdge,
} from "../hooks/usePlaybackPreferences";
import { peach, type ThemeScheme } from "../theme/colors";
import { useThemeMode } from "../theme/theme-mode";
import { peachAlpha, whiteAlpha } from "../theme/tokens";

/**
 * Per-profile settings page surfaced under ``/settings``.
 *
 * Scoped to the things a household member can actually change for
 * themselves: appearance (theme + button style), playback preferences
 * (audio / subtitle language, default quality, subtitle mode, what
 * happens between episodes), subtitle appearance, and a small About
 * panel with the app version + API health + language picker. Library /
 * metadata administration lives exclusively under ``/admin`` so the
 * admin and member surfaces don't duplicate the same actions.
 *
 * The layout follows ``specs/design_handoff_configuracoes``: sections of
 * hairline-separated rows, each **label + helper left, control right**,
 * with the control chosen by the shape of the choice — segmented for a
 * closed set of 2-4, a select only for the open-ended language lists,
 * swatches where the value *is* a color. Nothing here is a save form;
 * every control writes through on change.
 */
export function Settings() {
  const { t } = useTranslation();
  useDocumentTitle(t("settings.title"));
  const { data: health } = useHealth();
  // Playback preferences are persisted through the API (with a
  // localStorage cache) by this hook and consumed by the Player on
  // first play of a new media. The partial-update setter lets each
  // control be a one-liner.
  const [playbackPrefs, setPlaybackPrefs] = usePlaybackPreferences();
  const { scheme, setScheme, ctaStyle, setCtaStyle } = useThemeMode();

  const apiHealthy = health?.status === "healthy";
  const appearance = playbackPrefs.subtitleAppearance;

  /** Patch a single field of the subtitle appearance object. */
  const setAppearance = (patch: Partial<SubtitleAppearance>) =>
    setPlaybackPrefs({ subtitleAppearance: { ...appearance, ...patch } });

  /** Segmented options for a closed set of API enum values. */
  const modeOptions = <V extends string>(
    values: readonly V[],
    prefix: string,
  ): SegmentedOption<V>[] =>
    values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));

  return (
    <Box sx={{ px: { xs: 2, md: 3.5 }, py: { xs: 3, md: 5.5 }, maxWidth: 860, mx: "auto" }}>
      <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", md: "2rem" }, mb: 0.75 }}>
        {t("settings.title")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4.5 }}>
        {t("settings.pageHint")}
      </Typography>

      {/* ── Appearance ───────────────────────────────────── */}
      <SettingsSectionHead title={t("settings.appearance")} hint={t("settings.appearanceHint")} />
      <SettingsCard>
        <SettingsRow label={t("settings.theme")} description={t("settings.themeHint")} stack>
          <ThemeSwatchGrid
            value={scheme}
            onChange={(next: ThemeScheme) => setScheme(next)}
          />
        </SettingsRow>
        <SettingsRow
          label={t("settings.neutralPrimary")}
          description={t("settings.neutralPrimaryHint")}
        >
          <Switch
            checked={ctaStyle === "neutral"}
            onChange={(e) => setCtaStyle(e.target.checked ? "neutral" : "accent")}
            inputProps={{ "aria-label": t("settings.neutralPrimary") }}
          />
        </SettingsRow>
        <ThemePreview />
      </SettingsCard>

      {/* ── Playback ─────────────────────────────────────── */}
      <Box sx={{ mt: 4.25 }}>
        <SettingsSectionHead title={t("settings.playback")} hint={t("settings.playbackHint")} />
      </Box>
      <SettingsCard>
        <SettingsGroupLabel>{t("settings.groups.language")}</SettingsGroupLabel>
        <SettingsRow label={t("settings.preferredAudio")} labelId="audio-lang-label">
          <LanguageSelect
            labelId="audio-lang-label"
            value={playbackPrefs.audioLang}
            onChange={(audioLang) => setPlaybackPrefs({ audioLang })}
          >
            <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="ja">日本語</MenuItem>
          </LanguageSelect>
        </SettingsRow>
        <SettingsRow label={t("settings.preferredSubtitle")} labelId="subtitle-lang-label">
          <LanguageSelect
            labelId="subtitle-lang-label"
            value={playbackPrefs.subtitleLang}
            onChange={(subtitleLang) => setPlaybackPrefs({ subtitleLang })}
          >
            <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="off">{t("settings.subtitleModes.off")}</MenuItem>
          </LanguageSelect>
        </SettingsRow>
        <SettingsRow
          label={t("settings.subtitleMode")}
          description={t("settings.subtitleModeHint")}
        >
          <SegmentedControl<SubtitleMode>
            wrap
            value={playbackPrefs.subtitleMode}
            options={modeOptions(SUBTITLE_MODES, "settings.subtitleModes")}
            onChange={(subtitleMode) => setPlaybackPrefs({ subtitleMode })}
            ariaLabel={t("settings.subtitleMode")}
          />
        </SettingsRow>

        <SettingsGroupLabel>{t("settings.groups.quality")}</SettingsGroupLabel>
        <SettingsRow
          label={t("settings.defaultQuality")}
          description={t("settings.defaultQualityHint")}
        >
          <SegmentedControl<string>
            wrap
            value={playbackPrefs.defaultQuality}
            options={modeOptions(QUALITY_OPTIONS, "settings.qualityOptions")}
            onChange={(defaultQuality) => setPlaybackPrefs({ defaultQuality })}
            ariaLabel={t("settings.defaultQuality")}
          />
        </SettingsRow>

        {/* Opening / end-credits behaviour. The option values are the
            API enum verbatim (mapped from the shared constants, not
            retyped) — the backend rejects anything outside it rather
            than quietly ignoring it. */}
        <SettingsGroupLabel>{t("settings.groups.betweenEpisodes")}</SettingsGroupLabel>
        <SettingsRow
          label={t("settings.introSkipMode")}
          description={t("settings.introSkipModeHint")}
        >
          <SegmentedControl<IntroSkipMode>
            wrap
            value={playbackPrefs.introSkipMode}
            options={modeOptions(INTRO_SKIP_MODES, "settings.introSkipModes")}
            onChange={(introSkipMode) => setPlaybackPrefs({ introSkipMode })}
            ariaLabel={t("settings.introSkipMode")}
          />
        </SettingsRow>
        <SettingsRow
          label={t("settings.creditsSkipMode")}
          description={t("settings.creditsSkipModeHint")}
        >
          <SegmentedControl<CreditsSkipMode>
            wrap
            value={playbackPrefs.creditsSkipMode}
            options={modeOptions(CREDITS_SKIP_MODES, "settings.creditsSkipModes")}
            onChange={(creditsSkipMode) => setPlaybackPrefs({ creditsSkipMode })}
            ariaLabel={t("settings.creditsSkipMode")}
          />
        </SettingsRow>
      </SettingsCard>

      {/* ── Subtitle appearance ──────────────────────────── */}
      <Box sx={{ mt: 4.25 }}>
        <SettingsSectionHead
          title={t("settings.subtitleAppearance")}
          hint={t("settings.subtitleAppearanceHint")}
        />
      </Box>
      <SettingsCard>
        <SubtitlePreview appearance={appearance} />
        <SettingsRow label={t("settings.subtitleColor")}>
          <SubtitleColorSwatches
            value={appearance.color}
            onChange={(color) => setAppearance({ color })}
          />
        </SettingsRow>
        <SettingsRow label={t("settings.subtitleBackground")}>
          <SegmentedControl<string>
            wrap
            value={appearance.background}
            options={SUBTITLE_BACKGROUNDS.map((bg) => ({
              value: bg.value,
              label: t(`settings.backgrounds.${bg.labelKey}`),
            }))}
            onChange={(background) => setAppearance({ background })}
            ariaLabel={t("settings.subtitleBackground")}
          />
        </SettingsRow>
        <SettingsRow label={t("settings.subtitleSize")}>
          <SegmentedControl<SubtitleFontSize>
            wrap
            value={appearance.fontSize}
            options={modeOptions(SUBTITLE_FONT_SIZES, "settings.sizes")}
            onChange={(fontSize) => setAppearance({ fontSize })}
            ariaLabel={t("settings.subtitleSize")}
          />
        </SettingsRow>
        <SettingsRow label={t("settings.subtitleTextEdge")}>
          <SegmentedControl<SubtitleTextEdge>
            wrap
            value={appearance.textEdge}
            options={modeOptions(SUBTITLE_TEXT_EDGES, "settings.edges")}
            onChange={(textEdge) => setAppearance({ textEdge })}
            ariaLabel={t("settings.subtitleTextEdge")}
          />
        </SettingsRow>
        <SettingsCardFooter status={t("settings.autoSaved")}>
          <Button
            variant="hairline"
            onClick={() =>
              setPlaybackPrefs({
                subtitleAppearance: { ...DEFAULT_SUBTITLE_APPEARANCE },
              })
            }
          >
            {t("settings.resetSubtitles")}
          </Button>
        </SettingsCardFooter>
      </SettingsCard>

      {/* ── About ────────────────────────────────────────── */}
      <Box sx={{ mt: 4.25 }}>
        <SettingsSectionHead title={t("settings.about")} />
      </Box>
      <SettingsCard>
        <SettingsRow label={t("settings.version")}>
          <Typography variant="body1" color="text.secondary" fontWeight={600}>
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
      </SettingsCard>
    </Box>
  );
}

// ── Options ────────────────────────────────────────────────────────

/** Quality tiers offered in the picker (``DefaultQuality`` is open-ended). */
const QUALITY_OPTIONS = ["best", "1080p", "720p"] as const;

/**
 * Caption background fills. The values are CSS colors written straight
 * into the player overlay, so they stay exactly as previously stored.
 */
const SUBTITLE_BACKGROUNDS = [
  { value: "transparent", labelKey: "none" },
  { value: "rgba(0, 0, 0, 0.75)", labelKey: "semiTransparent" },
  { value: "rgba(0, 0, 0, 1)", labelKey: "solid" },
] as const;

// ── Shared components ──────────────────────────────────────────────

/**
 * Compact select for the open-ended language lists — the one place a
 * dropdown still beats a segmented control, since the option set grows
 * with whatever tracks the library holds.
 */
function LanguageSelect({
  labelId,
  value,
  onChange,
  children,
}: {
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Select
      size="small"
      labelId={labelId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{
        width: { xs: "100%", sm: "auto" },
        minWidth: 210,
        bgcolor: whiteAlpha(0.03),
        "& .MuiOutlinedInput-notchedOutline": { borderColor: whiteAlpha(0.08) },
      }}
    >
      {children}
    </Select>
  );
}

/**
 * Compact live sample of the selected theme — a mini media action bar echoing
 * the detail page: surface + title/meta (fg + muted), a primary CTA (accent or
 * white), a secondary button (neutral, or teal in "warmteal") and an
 * accent-tinted bookmark. It renders through the same theme variants/tokens as
 * the app, so it updates the instant a theme or the neutral-primary toggle
 * changes.
 */
function ThemePreview() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        mx: { xs: 2, sm: 2.75 },
        mb: 2.5,
        p: 2.25,
        borderRadius: 1.5,
        border: `1px solid ${whiteAlpha(0.08)}`,
        bgcolor: "background.paper",
      }}
    >
      <Typography
        variant="eyebrow"
        sx={{ color: "text.secondary", display: "block", mb: 1.25 }}
      >
        {t("settings.preview")}
      </Typography>
      <Typography variant="h3" sx={{ mb: 0.25 }}>
        HomeFlix
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
        2001 · 1h 30min · Thriller
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Button variant="cta" startIcon={<Play size={16} />}>
          {t("settings.previewPlay")}
        </Button>
        <Button variant="hairline" startIcon={<Film size={16} />}>
          {t("settings.previewTrailer")}
        </Button>
        <IconButton
          aria-hidden
          tabIndex={-1}
          sx={{
            borderRadius: 1.5,
            border: `1px solid ${peachAlpha(0.4)}`,
            bgcolor: peachAlpha(0.12),
            color: peach.main,
          }}
        >
          <Bookmark size={16} />
        </IconButton>
      </Box>
    </Box>
  );
}
