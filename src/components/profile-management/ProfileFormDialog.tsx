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
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { fontFamily, whiteAlpha, scrim } from "../../theme/tokens";
import { error as errorColor } from "../../theme/colors";
import { useDeleteProfileAvatar, useUploadProfileAvatar } from "../../api/auth";
import { ApiError } from "../../api/client";
import type { CreateProfileInput, Library, Profile } from "../../api/types";
import { PARENTAL_CONTROLS_ENABLED } from "../../config/featureFlags";
import { Avatar } from "../auth/Avatar";
import { initialsForName, toneForProfile } from "../auth/avatarUtils";

export interface ProfileFormSubmit {
  name: string;
  allowed_library_ids: string[];
  /**
   * The limit to write: a minimum age, or ``null`` to make the profile
   * unrestricted. The key is absent when the form leaves the limit
   * alone, which the parent must forward as an omitted field.
   */
  maturity_limit?: number | null;
}

/**
 * Age steps the selector offers besides "unrestricted" (ADR-035, D7):
 * ``0`` is "L" (all audiences), then the age ratings up to 16. The API
 * accepts any age from 0 to 21.
 */
const MATURITY_LIMIT_AGES = [0, 10, 12, 14, 16];

/** Radio value for "no limit"; the ages use their decimal string. */
const UNRESTRICTED = "unrestricted";

const limitToRadio = (limit: number | null) => (limit === null ? UNRESTRICTED : String(limit));
const radioToLimit = (value: string) => (value === UNRESTRICTED ? null : Number(value));

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
 * Edit mode pre-fills name / maturity limit / allowed_library_ids
 * from the supplied profile. Create mode starts blank with the backend
 * defaults (unrestricted, deny-all ACL — checking nothing in the grid
 * leaves the new profile with an empty ``allowed_library_ids``,
 * which on the backend means it sees nothing). The form deliberately
 * does NOT pre-check every library on create: the operator should
 * pick what a household member sees rather than auto-grant
 * everything.
 *
 * The maturity limit selector (ADR-035) only renders while
 * ``PARENTAL_CONTROLS_ENABLED`` is on. It offers "unrestricted" and the
 * D7 age steps; a limit set outside those steps through the API is
 * listed too, so the stored value is always the selected one. It warns
 * that the limit does not cover video segments the server already
 * cached, which stay reachable by direct link until ADR-036.
 *
 * Submit emits ``{ name, allowed_library_ids }`` plus
 * ``maturity_limit`` ONLY when the operator changed it: an unchanged
 * limit is never written, so a rename or a library edit cannot clear
 * or re-assert a limit, and choosing "unrestricted" on a limited
 * profile emits an explicit ``null``. The parent translates that into
 * a ``CreateProfileInput`` or ``UpdateProfileInput``. Decoupling from
 * the API DTO keeps this component reusable.
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
  // ``undefined`` from a backend without the field reads as unrestricted.
  const initialLimit = profile?.maturity_limit ?? null;
  const [limit, setLimit] = useState<number | null>(initialLimit);
  const limitAges =
    initialLimit === null || MATURITY_LIMIT_AGES.includes(initialLimit)
      ? MATURITY_LIMIT_AGES
      : [...MATURITY_LIMIT_AGES, initialLimit].sort((a, b) => a - b);
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
      allowed_library_ids: [...selected],
      ...(PARENTAL_CONTROLS_ENABLED && limit !== initialLimit ? { maturity_limit: limit } : {}),
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

        {PARENTAL_CONTROLS_ENABLED && (
          <FormControl
            component="fieldset"
            disabled={submitting}
            sx={{ mt: 2, display: "flex" }}
          >
            <FormLabel component="legend" sx={{ typography: "body2", fontWeight: 600 }}>
              {t("profileManagement.fields.maturityLimit")}
            </FormLabel>
            <RadioGroup
              row
              value={limitToRadio(limit)}
              onChange={(e) => setLimit(radioToLimit(e.target.value))}
            >
              <FormControlLabel
                value={UNRESTRICTED}
                control={<Radio />}
                label={t("profileManagement.fields.maturityLimitUnrestricted")}
              />
              {limitAges.map((age) => (
                <FormControlLabel
                  key={age}
                  value={String(age)}
                  control={<Radio />}
                  label={age === 0 ? "L" : String(age)}
                />
              ))}
            </RadioGroup>
            <FormHelperText sx={{ ml: 0 }}>
              {t("profileManagement.fields.maturityLimitHelp")}
            </FormHelperText>
            <FormHelperText sx={{ ml: 0 }}>
              {t("profileManagement.fields.maturityLimitCacheNote")}
            </FormHelperText>
          </FormControl>
        )}

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
                    <Typography variant="body2" sx={{ fontFamily: fontFamily.mono, opacity: 0.7 }}>
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
