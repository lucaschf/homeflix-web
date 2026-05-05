import { Box, Chip, IconButton, Typography } from "@mui/material";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../auth/Avatar";
import { initialsForName, toneForProfile } from "../auth/avatarUtils";
import type { Profile } from "../../api/types";

interface ProfileRowProps {
  profile: Profile;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  /** Disables both buttons while a sibling mutation is in flight. */
  disabled?: boolean;
}

/**
 * One row in the Settings → Profiles list.
 *
 * Mirrors the Library row layout (avatar/icon on the left, name +
 * metadata in the middle, action icons on the right) so the
 * Settings page reads as a coherent list of operator-managed
 * resources. Reuses the Avatar component from the picker so the
 * same deterministic radial-gradient identity carries across the
 * two screens.
 */
export function ProfileRow({ profile, onEdit, onDelete, disabled = false }: ProfileRowProps) {
  const { t } = useTranslation();
  const libCount = profile.allowed_library_ids.length;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2.5,
        py: 2,
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0, flex: 1 }}>
        <Avatar
          initials={initialsForName(profile.name)}
          tone={toneForProfile(profile.id)}
          size={40}
        />
        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={profile.name}>
              {profile.name}
            </Typography>
            {profile.is_kids && (
              <Chip
                label={t("profileManagement.row.kids")}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  bgcolor: "rgba(96, 165, 250, 0.12)",
                  color: "info.light",
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t("profileManagement.row.librariesCount", { count: libCount })}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => onEdit(profile)}
          disabled={disabled}
          aria-label={t("profileManagement.actions.edit")}
          sx={{ color: "text.secondary", "&:hover:not(:disabled)": { color: "text.primary" } }}
        >
          <Pencil size={16} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onDelete(profile)}
          disabled={disabled}
          aria-label={t("profileManagement.actions.delete")}
          sx={{ color: "text.secondary", "&:hover:not(:disabled)": { color: "error.light" } }}
        >
          <Trash2 size={16} />
        </IconButton>
      </Box>
    </Box>
  );
}
