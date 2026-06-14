import { Box, Stack, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import { RotateCcw, Save } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AdminSettingSource } from "../../../api/types";
import {
  AdminBadge,
  type BadgeTone,
  AdminButton,
  AdminCard,
  AdminCardHeader,
} from "../../../components/admin";
import { whiteAlpha } from "../../../theme/tokens";

interface SettingsCardShellProps {
  /** Section title (already localised). */
  title: string;
  /** Optional subtitle (already localised). */
  subtitle?: string;
  icon: LucideIcon;
  /** ``source`` of the row currently rendered. ``"default"`` means
   *  the bucket has never been persisted. */
  source: AdminSettingSource;
  /** Last-edited ISO timestamp (``null`` when ``source ==="default"``). */
  updatedAt: string | null;
  /** Form fields to render in the body. */
  children: ReactNode;
  /** Disabled when the form has not been modified relative to the
   *  hydrated server state. */
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  /** Drops every dirty edit back to the persisted server state. */
  onReset: () => void;
  /** Inline error surfaced under the Save button — kept inside the
   *  card so the operator sees it next to the failing form. */
  errorMessage: string | null;
}

const SOURCE_TONE: Record<AdminSettingSource, BadgeTone> = {
  admin: "ok",
  migration_seed: "neutral",
  sql_override: "warn",
  default: "neutral",
};

/**
 * Shared chrome for each settings bucket card: title row with a
 * provenance chip, helper subtitle, a body slot for the fields, and
 * a footer row with Reset + Save buttons and an inline error.
 *
 * Concentrating the boilerplate here keeps the five bucket-specific
 * card components focused on field state and the save payload —
 * they each render their own ``<AdminFormSection>`` rows and pass
 * ``onSave`` / ``canSave`` / ``saving`` through. Provenance and
 * last-edited rendering stays in one place.
 */
export function SettingsCardShell({
  title,
  subtitle,
  icon,
  source,
  updatedAt,
  children,
  canSave,
  saving,
  onSave,
  onReset,
  errorMessage,
}: SettingsCardShellProps) {
  const { t, i18n } = useTranslation();

  const sourceLabel = t(`admin.settings.source.${source}`);
  const lastEdited = useMemo(() => {
    if (!updatedAt) return null;
    try {
      return new Date(updatedAt).toLocaleString(i18n.language);
    } catch {
      return updatedAt;
    }
  }, [updatedAt, i18n.language]);

  return (
    <AdminCard>
      <AdminCardHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        action={<AdminBadge tone={SOURCE_TONE[source]}>{sourceLabel}</AdminBadge>}
      />

      {children}

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
            </Typography>
          )}
          {errorMessage && (
            <Typography
              variant="caption"
              color="error"
              sx={{ display: "block", mt: 0.5 }}
            >
              {errorMessage}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1.25}>
          <AdminButton
            variant="ghost"
            startIcon={<RotateCcw size={14} />}
            onClick={onReset}
            disabled={!canSave || saving}
          >
            {t("admin.settings.actions.reset")}
          </AdminButton>
          <AdminButton
            variant="primary"
            startIcon={<Save size={14} />}
            onClick={onSave}
            disabled={!canSave || saving}
          >
            {saving
              ? t("admin.settings.actions.saving")
              : t("admin.settings.actions.save")}
          </AdminButton>
        </Stack>
      </Stack>
    </AdminCard>
  );
}
