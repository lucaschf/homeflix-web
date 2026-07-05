import { Box, Stack, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import { RotateCcw, Save } from "lucide-react";
import { type ReactNode, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AdminSettingSource } from "../../../api/types";
import { AdminBadge, AdminButton } from "../../../components/admin";
import { peachAlpha, whiteAlpha } from "../../../theme/tokens";
import { parseServerDate } from "../../../utils/datetime";
import { useSettingsSection } from "./SettingsSectionContext";

interface SettingsCardShellProps {
  /** Section title (already localised). */
  title: string;
  /** Fuller description shown beneath the header (already localised). */
  subtitle?: string;
  icon: LucideIcon;
  /** ``source`` of the row currently rendered. ``"default"`` means
   *  the bucket has never been persisted. */
  source: AdminSettingSource;
  /** Last-edited ISO timestamp (``null`` when ``source === "default"``). */
  updatedAt: string | null;
  /** Form fields to render in the body. */
  children: ReactNode;
  /** True when the form differs from the persisted server state.
   *  Drives the Save/Reset enabled state, the footer "unsaved"
   *  indicator and (lifted via context) the rail/accordion dot. */
  dirty: boolean;
  /** ``dirty`` gated by field validity — disables Save on bad input. */
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  /** Drops every dirty edit back to the persisted server state. */
  onReset: () => void;
  /** Inline error surfaced under the Save button — kept inside the
   *  card so the operator sees it next to the failing form. */
  errorMessage: string | null;
}

/** Peach dot marking a section with unsaved edits. */
function DirtyDot() {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        bgcolor: "primary.main",
        boxShadow: `0 0 0 3px ${peachAlpha(0.16)}`,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Shared chrome for each settings bucket card, adapting to the active
 * layout via ``SettingsSectionContext``:
 *
 * - **rail** — draws its own header (peach icon, title, unsaved dot,
 *   scope badge), the description, the field body and the footer.
 * - **accordion** — the header lives on the accordion row, so the
 *   shell renders only description + body + footer.
 *
 * Either way the shell owns the footer (last-edited + provenance,
 * unsaved indicator, Reset/Save) and lifts the section's dirty flag
 * up so the surrounding layout can render its own dot. It no longer
 * wraps the content in a bordered ``AdminCard`` — the pane (rail) or
 * the accordion row supplies the surface.
 */
export function SettingsCardShell({
  title,
  subtitle,
  icon: Icon,
  source,
  updatedAt,
  children,
  dirty,
  canSave,
  saving,
  onSave,
  onReset,
  errorMessage,
}: SettingsCardShellProps) {
  const { t, i18n } = useTranslation();
  const { variant, scope, reportDirty } = useSettingsSection();

  // Lift the dirty flag so the rail nav / accordion header can show
  // the unsaved-edits dot even while this section is collapsed/hidden.
  useEffect(() => {
    reportDirty(dirty);
  }, [dirty, reportDirty]);
  useEffect(() => () => reportDirty(false), [reportDirty]);

  const sourceLabel = t(`admin.settings.source.${source}`);
  const scopeLabel = t(`admin.settings.scope.${scope}`);
  const lastEdited = useMemo(() => {
    if (!updatedAt) return null;
    try {
      return parseServerDate(updatedAt).toLocaleString(i18n.language);
    } catch {
      return updatedAt;
    }
  }, [updatedAt, i18n.language]);

  return (
    <Box>
      {variant === "rail" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Box sx={{ color: "primary.main", display: "flex" }}>
            <Icon size={19} aria-hidden />
          </Box>
          <Typography variant="h3" component="h2" sx={{ m: 0 }}>
            {title}
          </Typography>
          {dirty && <DirtyDot />}
          <Box sx={{ flex: 1 }} />
          <AdminBadge tone={scope === "admin" ? "ok" : "neutral"}>{scopeLabel}</AdminBadge>
        </Box>
      )}

      {subtitle && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 900, lineHeight: 1.6, mb: 0.5 }}
        >
          {subtitle}
        </Typography>
      )}

      <Box sx={{ mt: 1 }}>{children}</Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mt: 3, pt: 2.25, borderTop: `1px solid ${whiteAlpha(0.06)}` }}
      >
        <Box sx={{ minWidth: 0 }}>
          {lastEdited && (
            <Typography variant="caption" color="text.secondary">
              {t("admin.settings.lastEdited", { date: lastEdited })}
              {source !== "admin" && ` · ${sourceLabel}`}
            </Typography>
          )}
          {!lastEdited && (
            <Typography variant="caption" color="text.secondary">
              {sourceLabel}
            </Typography>
          )}
          {dirty && (
            <Typography
              variant="caption"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.875,
                color: "primary.main",
                ml: lastEdited ? 1.5 : 0,
              }}
            >
              <DirtyDot />
              {t("admin.settings.unsaved")}
            </Typography>
          )}
          {errorMessage && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
              {errorMessage}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1.25}>
          <AdminButton
            variant="ghost"
            icon={<RotateCcw size={14} />}
            onClick={onReset}
            disabled={!dirty || saving}
          >
            {t("admin.settings.actions.discard")}
          </AdminButton>
          <AdminButton
            variant="primary"
            icon={<Save size={14} />}
            onClick={onSave}
            disabled={!canSave || saving}
          >
            {saving ? t("admin.settings.actions.saving") : t("admin.settings.actions.save")}
          </AdminButton>
        </Stack>
      </Stack>
    </Box>
  );
}
