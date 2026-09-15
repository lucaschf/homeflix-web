import { useId, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { border, fontFamily, fontSize, whiteAlpha, scrim } from "../../theme/tokens";
import { error as errorColor } from "../../theme/colors";
import { useDeleteProfileAvatar, useUploadProfileAvatar } from "../../api/auth";
import { ApiError } from "../../api/client";
import type { CreateProfileInput, Library, Profile } from "../../api/types";
import { PARENTAL_CONTROLS_ENABLED } from "../../config/featureFlags";
import { Avatar } from "../auth/Avatar";
import { initialsForName, toneForProfile } from "../auth/avatarUtils";
import { MaturityLimitSelector } from "./MaturityLimitSelector";
import { selectionAccent } from "./selectionAccent";

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

/** Neutral outlined look shared by "Change photo" and "Cancel". */
const outlinedNeutralSx = {
  textTransform: "none",
  borderColor: whiteAlpha(0.15),
  color: "text.primary",
  "&:hover": {
    borderColor: whiteAlpha(0.3),
    bgcolor: whiteAlpha(0.04),
  },
} as const;

/**
 * Modal form for creating or editing a profile.
 *
 * Edit mode pre-fills name / maturity limit / allowed_library_ids
 * from the supplied profile and tags the title with the profile's first
 * name. Create mode starts blank with the backend defaults
 * (unrestricted, deny-all ACL — checking nothing in the list leaves the
 * new profile with an empty ``allowed_library_ids``, which on the
 * backend means it sees nothing). The form deliberately does NOT
 * pre-check every library on create: the operator should pick what a
 * household member sees rather than auto-grant everything.
 *
 * The maturity limit ladder (ADR-035, ``MaturityLimitSelector``) only
 * renders while ``PARENTAL_CONTROLS_ENABLED`` is on. It offers
 * "unrestricted" and the D7 age steps; a limit set outside those steps
 * through the API is placed on it too, so the stored value is always the
 * selected one. Its note warns that the limit does not cover video
 * segments the server already cached, which stay reachable by direct link
 * until ADR-036.
 *
 * The body is two labelled sections. With the ladder, the dialog is
 * ``md`` wide and, from that breakpoint up, puts the profile basics
 * (avatar, name, libraries) in a narrow column beside the limit; on
 * narrower screens the sections stack, basics first. Without the ladder
 * there is only the basics section, at the ``sm`` width.
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
  const nameId = useId();

  // Initial state lives in lazy ``useState`` initializers so a
  // discarded edit does NOT leak into the next session of the
  // dialog. The parent passes a ``key`` derived from
  // ``profile?.id ?? "create"`` so this component remounts fresh
  // whenever the target profile changes — no useEffect dance.
  const [name, setName] = useState(profile?.name ?? "");
  // ``undefined`` from a backend without the field reads as unrestricted.
  const initialLimit = profile?.maturity_limit ?? null;
  const [limit, setLimit] = useState<number | null>(initialLimit);
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
  // The saved name, not the one being typed: the tag says which profile is open.
  const firstName = profile?.name.trim().split(/\s+/)[0] ?? "";

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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={PARENTAL_CONTROLS_ENABLED ? "md" : "sm"}
      fullWidth
      slotProps={{
        paper: {
          // Narrow screens keep a 16px margin instead of 32px, so the ladder has room.
          sx: {
            m: { xs: 2, sm: 4 },
            width: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
            maxHeight: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
          },
        },
      }}
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 2, sm: 3 } }}
      >
        {isEdit ? t("profileManagement.editTitle") : t("profileManagement.createTitle")}{" "}
        {firstName && (
          <Box
            component="span"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              px: 1,
              py: 0.25,
              borderRadius: 999,
              border: `1px solid ${border.hairlineStrong}`,
              color: "text.secondary",
              fontFamily: fontFamily.mono,
              fontSize: fontSize.badge,
              fontWeight: 500,
              letterSpacing: "0.12em",
              lineHeight: 1.6,
              textTransform: "uppercase",
            }}
          >
            {firstName}
          </Box>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
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

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: PARENTAL_CONTROLS_ENABLED ? "minmax(0, 1fr) minmax(0, 2fr)" : "minmax(0, 1fr)",
            },
            columnGap: 4,
            alignItems: "start",
          }}
        >
          <Box component="section" aria-label={t("profileManagement.sections.basics")}>
            {isEdit && profile && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
                <Box sx={{ position: "relative", flexShrink: 0 }}>
                  <Avatar
                    initials={initialsForName(profile.name)}
                    tone={toneForProfile(profile.id)}
                    avatarUrl={avatarUrl}
                    size={72}
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
                <Box
                  sx={{
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 0.5,
                  }}
                >
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
                    <Button
                      onClick={openFilePicker}
                      disabled={avatarBusy || submitting}
                      variant="outlined"
                      size="small"
                      sx={outlinedNeutralSx}
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
                          color: "text.secondary",
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

            <Typography
              component="label"
              htmlFor={nameId}
              variant="eyebrow"
              sx={{
                display: "block",
                mb: 0.75,
                color: "text.secondary",
                fontSize: fontSize.badge,
                letterSpacing: "0.14em",
              }}
            >
              {t("profileManagement.fields.name")}
            </Typography>
            <TextField
              id={nameId}
              autoFocus
              fullWidth
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              slotProps={{
                htmlInput: { maxLength: 50 },
                input: {
                  sx: {
                    bgcolor: whiteAlpha(0.04),
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: border.hairlineStrong },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: whiteAlpha(0.24) },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "primary.main",
                    },
                  },
                },
              }}
            />

            <Typography variant="body2" sx={{ fontWeight: 600, mt: 3 }}>
              {t("profileManagement.fields.libraries")}
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary", mt: 0.25, mb: 1.5 }}
            >
              {t("profileManagement.fields.librariesHelp")}
            </Typography>

            {libraries.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                {t("profileManagement.fields.noLibraries")}
              </Typography>
            ) : (
              <FormControl component="fieldset" disabled={submitting} sx={{ display: "flex" }}>
                <FormGroup sx={{ gap: 1 }}>
                  {libraries.map((lib) => {
                    const checked = selected.has(lib.id);
                    return (
                      <FormControlLabel
                        key={lib.id}
                        control={
                          <Checkbox
                            checked={checked}
                            onChange={() => toggle(lib.id)}
                            size="small"
                            sx={(theme) => ({
                              p: 0.25,
                              "&.Mui-checked": { color: selectionAccent(theme) },
                            })}
                          />
                        }
                        label={
                          <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, color: "text.primary" }}
                            >
                              {lib.name}
                            </Typography>
                            {/* Only admins receive paths; for everyone else the line is empty. */}
                            {lib.paths.length > 0 && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  fontFamily: fontFamily.mono,
                                  fontWeight: 400,
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {lib.paths.join(", ")}
                              </Typography>
                            )}
                          </Box>
                        }
                        sx={(theme) => {
                          const accent = selectionAccent(theme);
                          return {
                            m: 0,
                            gap: 1.25,
                            alignItems: "flex-start",
                            px: 1.25,
                            py: 1,
                            borderRadius: 1.25,
                            border: "1px solid",
                            borderColor: checked ? accent : border.hairlineStrong,
                            bgcolor: checked ? alpha(accent, 0.08) : whiteAlpha(0.02),
                            transition: "border-color 120ms ease, background-color 120ms ease",
                            "&:hover": {
                              borderColor: checked ? accent : whiteAlpha(0.24),
                              bgcolor: checked ? alpha(accent, 0.12) : whiteAlpha(0.04),
                            },
                            "&:has(.Mui-focusVisible)": {
                              outline: `2px solid ${accent}`,
                              outlineOffset: 2,
                            },
                            "&.Mui-disabled": { cursor: "default", opacity: 0.6 },
                            "& .MuiFormControlLabel-label": { flex: 1, minWidth: 0 },
                          };
                        }}
                      />
                    );
                  })}
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
          </Box>

          {PARENTAL_CONTROLS_ENABLED && (
            <Box
              component="section"
              aria-label={t("profileManagement.sections.maturity")}
              sx={{
                // Stacked under the basics on narrow screens, with a hairline
                // between the two; beside them from ``md`` up.
                mt: { xs: 3, md: 0 },
                pt: { xs: 3, md: 0 },
                borderTop: { xs: `1px solid ${whiteAlpha(0.08)}`, md: "none" },
              }}
            >
              <MaturityLimitSelector
                value={limit}
                storedLimit={initialLimit}
                onChange={setLimit}
                disabled={submitting}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions
        disableSpacing
        sx={{
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
          px: { xs: 2, sm: 3 },
          py: 2,
        }}
      >
        {isEdit && onDelete ? (
          <Button
            onClick={onDelete}
            disabled={submitting}
            color="inherit"
            sx={{
              textTransform: "none",
              fontWeight: 500,
              color: "text.secondary",
              "&:hover": { color: "error.light", bgcolor: alpha(errorColor.main, 0.08) },
            }}
          >
            {t("profileManagement.actions.deleteProfile")}
          </Button>
        ) : (
          <Box />
        )}
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          <Button onClick={onClose} disabled={submitting} variant="outlined" sx={outlinedNeutralSx}>
            {t("profileManagement.actions.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} variant="contained">
            {isEdit ? t("profileManagement.actions.save") : t("profileManagement.actions.create")}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export type { CreateProfileInput };
