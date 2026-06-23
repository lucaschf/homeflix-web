import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { whiteAlpha, scrim } from "../../theme/tokens";
import { error as errorColor } from "../../theme/colors";
import { useDeleteProfileAvatar, useUploadProfileAvatar } from "../../api/auth";
import { ApiError } from "../../api/client";
import type { CreateProfileInput, Library, Profile } from "../../api/types";
import { Avatar } from "../auth/Avatar";
import { initialsForName, toneForProfile } from "../auth/avatarUtils";

export interface ProfileFormSubmit {
  name: string;
  is_kids: boolean;
  allowed_library_ids: string[];
}

interface ProfileFormDialogProps {
  open: boolean;
  /** ``null`` = create mode; an existing ``Profile`` = edit mode. */
  profile: Profile | null;
  libraries: Library[];
  /** Pending state for the wrapping mutation; disables submit while in flight. */
  submitting: boolean;
  /** Optional inline error rendered above the form (already translated). */
  error?: string | null;
  onClose: () => void;
  onSubmit: (body: ProfileFormSubmit) => void;
  /**
   * Optional delete entry-point. Only rendered in edit mode (when
   * ``profile`` is set) — the parent owns the confirmation dialog
   * so this component just signals "user wants to delete".
   */
  onDelete?: () => void;
}

/**
 * Modal form for creating or editing a profile.
 *
 * Edit mode pre-fills name / kids flag / allowed_library_ids from
 * the supplied profile. Create mode starts blank with the backend
 * defaults (kids off, deny-all ACL — checking nothing in the grid
 * leaves the new profile with an empty ``allowed_library_ids``,
 * which on the backend means it sees nothing). The form deliberately
 * does NOT pre-check every library on create: the operator should
 * pick what a household member sees rather than auto-grant
 * everything (parental gating is the whole point of the ACL).
 *
 * Submit emits a normalized ``{ name, is_kids, allowed_library_ids }``
 * — the parent translates that into a ``CreateProfileInput`` or
 * ``UpdateProfileInput``. Decoupling from the API DTO keeps this
 * component reusable.
 */
export function ProfileFormDialog({
  open,
  profile,
  libraries,
  submitting,
  error,
  onClose,
  onSubmit,
  onDelete,
}: ProfileFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = profile !== null;

  // Initial state lives in lazy ``useState`` initializers so a
  // discarded edit does NOT leak into the next session of the
  // dialog. The parent passes a ``key`` derived from
  // ``profile?.id ?? "create"`` so this component remounts fresh
  // whenever the target profile changes — no useEffect dance.
  const [name, setName] = useState(profile?.name ?? "");
  const [isKids, setIsKids] = useState(profile?.is_kids ?? false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(profile?.allowed_library_ids ?? []),
  );

  // Avatar state. ``avatarUrl`` shadows ``profile.avatar_url`` so
  // the preview flips immediately after a successful upload /
  // delete, without waiting for the parent to re-fetch and
  // re-mount the dialog. ``avatarError`` surfaces 413 / 415 from
  // the server inline in the avatar section, separate from the
  // form-level ``error`` prop (which the parent owns).
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAvatar = useUploadProfileAvatar();
  const deleteAvatar = useDeleteProfileAvatar();
  const avatarBusy = uploadAvatar.isPending || deleteAvatar.isPending;

  const openFilePicker = () => {
    if (avatarBusy || !profile) return;
    setAvatarError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input value so picking the SAME file again still
    // fires ``onChange`` (browsers de-dupe identical paths).
    event.target.value = "";
    if (!file || !profile) return;
    try {
      const updated = await uploadAvatar.mutateAsync({
        profileId: profile.id,
        file,
      });
      setAvatarUrl(updated.avatar_url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 413) {
        setAvatarError(t("profileManagement.avatar.errors.tooLarge"));
      } else if (err instanceof ApiError && err.status === 415) {
        setAvatarError(t("profileManagement.avatar.errors.unsupported"));
      } else {
        setAvatarError(t("profileManagement.avatar.errors.uploadFailed"));
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile) return;
    setAvatarError(null);
    try {
      const updated = await deleteAvatar.mutateAsync(profile.id);
      setAvatarUrl(updated.avatar_url);
    } catch {
      setAvatarError(t("profileManagement.avatar.errors.removeFailed"));
    }
  };

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;

  // Render any allowed_library_ids that point at libraries the
  // operator no longer has — keeps the user aware they exist (and
  // can remove them) rather than silently dropping the row.
  const orphanIds = useMemo(() => {
    const known = new Set(libraries.map((l) => l.id));
    return [...selected].filter((id) => !known.has(id));
  }, [libraries, selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: trimmedName,
      is_kids: isKids,
      allowed_library_ids: [...selected],
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit ? t("profileManagement.editTitle") : t("profileManagement.createTitle")}
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Typography
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(errorColor.main, 0.08),
              border: `1px solid ${alpha(errorColor.main, 0.25)}`,
              color: alpha(errorColor.light, 0.95),
              fontSize: "0.6875rem",
            }}
          >
            {error}
          </Typography>
        )}

        {isEdit && profile && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2.5,
              mb: 2,
              pb: 2,
              borderBottom: `1px solid ${whiteAlpha(0.08)}`,
            }}
          >
            <Box sx={{ position: "relative" }}>
              <Avatar
                initials={initialsForName(profile.name)}
                tone={toneForProfile(profile.id)}
                avatarUrl={avatarUrl}
                size={80}
                shape="circle"
              />
              {avatarBusy && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    bgcolor: scrim(0.55),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={22} sx={{ color: "primary.main" }} />
                </Box>
              )}
            </Box>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  onClick={openFilePicker}
                  disabled={avatarBusy || submitting}
                  variant="outlined"
                  size="small"
                  sx={{
                    textTransform: "none",
                    borderColor: whiteAlpha(0.15),
                    color: "text.primary",
                    "&:hover": {
                      borderColor: whiteAlpha(0.3),
                      bgcolor: whiteAlpha(0.04),
                    },
                  }}
                >
                  {t("profileManagement.avatar.change")}
                </Button>
                {avatarUrl && (
                  <Button
                    onClick={handleRemoveAvatar}
                    disabled={avatarBusy || submitting}
                    size="small"
                    color="inherit"
                    sx={{
                      textTransform: "none",
                      color: whiteAlpha(0.6),
                      "&:hover": { color: "text.primary", bgcolor: whiteAlpha(0.04) },
                    }}
                  >
                    {t("profileManagement.avatar.remove")}
                  </Button>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t("profileManagement.avatar.hint")}
              </Typography>
              {avatarError && (
                <Typography
                  variant="caption"
                  sx={{ color: alpha(errorColor.light, 0.95), mt: 0.25 }}
                >
                  {avatarError}
                </Typography>
              )}
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={handleFileChange}
            />
          </Box>
        )}

        <TextField
          autoFocus
          fullWidth
          label={t("profileManagement.fields.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          margin="normal"
          slotProps={{ htmlInput: { maxLength: 50 } }}
          disabled={submitting}
        />

        <FormControlLabel
          sx={{ mt: 2 }}
          control={
            <Switch
              checked={isKids}
              onChange={(e) => setIsKids(e.target.checked)}
              disabled={submitting}
            />
          }
          label={t("profileManagement.fields.isKids")}
        />
        <FormHelperText sx={{ ml: 0 }}>
          {t("profileManagement.fields.isKidsHelp")}
        </FormHelperText>

        <Divider sx={{ my: 3, borderColor: whiteAlpha(0.08) }} />

        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
          {t("profileManagement.fields.libraries")}
        </Typography>
        <FormHelperText sx={{ ml: 0, mb: 2 }}>
          {t("profileManagement.fields.librariesHelp")}
        </FormHelperText>

        {libraries.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
            {t("profileManagement.fields.noLibraries")}
          </Typography>
        ) : (
          <FormControl component="fieldset" disabled={submitting}>
            <FormGroup>
              {libraries.map((lib) => (
                <FormControlLabel
                  key={lib.id}
                  control={
                    <Checkbox
                      checked={selected.has(lib.id)}
                      onChange={() => toggle(lib.id)}
                    />
                  }
                  label={
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      <Typography variant="body2" fontWeight={500}>
                        {lib.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {lib.paths.join(", ")}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </FormGroup>
          </FormControl>
        )}

        {orphanIds.length > 0 && (
          <>
            <Divider sx={{ my: 2, borderColor: whiteAlpha(0.08) }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              {t("profileManagement.fields.orphanLibraries")}
            </Typography>
            <FormGroup>
              {orphanIds.map((id) => (
                <FormControlLabel
                  key={id}
                  control={
                    <Checkbox
                      checked
                      onChange={() => toggle(id)}
                      disabled={submitting}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontFamily: "monospace", opacity: 0.7 }}>
                      {id}
                    </Typography>
                  }
                />
              ))}
            </FormGroup>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
        {isEdit && onDelete ? (
          <Button
            onClick={onDelete}
            disabled={submitting}
            color="error"
            sx={{ textTransform: "none", fontWeight: 500 }}
          >
            {t("profileManagement.actions.deleteProfile")}
          </Button>
        ) : (
          <Box />
        )}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            {t("profileManagement.actions.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            variant="contained"
          >
            {isEdit ? t("profileManagement.actions.save") : t("profileManagement.actions.create")}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export type { CreateProfileInput };
