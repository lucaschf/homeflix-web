import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Pencil, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { whiteAlpha, inkAlpha, peachAlpha } from "../theme/tokens";
import { error } from "../theme/colors";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useCreateProfile,
  useDeleteProfile,
  useProfiles,
  useUpdateProfile,
} from "../api/auth";
import { useLibraries } from "../api/hooks";
import { ApiError } from "../api/client";
import type { Profile } from "../api/types";
import { AuthShell } from "../components/auth/AuthShell";
import { Avatar } from "../components/auth/Avatar";
import { initialsForName, toneForProfile } from "../components/auth/avatarUtils";
import {
  ProfileFormDialog,
  type ProfileFormSubmit,
} from "../components/profile-management/ProfileFormDialog";
import { Logo } from "../components/Logo";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * Dedicated profile-management screen — same backdrop as the
 * picker, with HBO-style avatar tiles in a row, pencil edit
 * overlays, a "+ New Profile" tile and a "Done" CTA at the
 * bottom that returns the user to the catalog (or back to the
 * picker when entered from there).
 *
 * Reuses ``ProfileFormDialog`` for create/edit and translates
 * the backend's 409 ("can't delete the last profile") into a
 * friendly inline message in the confirm dialog.
 */
export function ManageProfiles() {
  const { t } = useTranslation();
  useDocumentTitle(t("profileManagement.manageTitle"));
  const navigate = useNavigate();
  const location = useLocation();
  const profilesQuery = useProfiles();
  const { data: libraries } = useLibraries();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();

  const [editing, setEditing] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const profiles = profilesQuery.data ?? [];
  const submitting = createProfile.isPending || updateProfile.isPending;
  const deleting = deleteProfile.isPending;
  const dialogOpen = creating || editing !== null;

  // "Done" returns to wherever the user came from when that
  // origin is known (e.g. the picker linked here). Otherwise
  // fall through to the catalog home — never get stuck.
  const handleDone = () => {
    const origin = (location.state as { from?: string } | null)?.from;
    navigate(origin && origin !== location.pathname ? origin : "/", {
      replace: true,
    });
  };

  const openCreate = () => {
    setFormError(null);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (profile: Profile) => {
    setFormError(null);
    setCreating(false);
    setEditing(profile);
  };

  const closeDialog = () => {
    if (submitting) return;
    setEditing(null);
    setCreating(false);
  };

  const handleSubmit = async (body: ProfileFormSubmit) => {
    setFormError(null);
    try {
      if (editing) {
        await updateProfile.mutateAsync({
          profileId: editing.id,
          input: {
            name: body.name,
            is_kids: body.is_kids,
            allowed_library_ids: body.allowed_library_ids,
          },
        });
      } else {
        await createProfile.mutateAsync({
          name: body.name,
          is_kids: body.is_kids,
          allowed_library_ids: body.allowed_library_ids,
        });
      }
      closeDialog();
    } catch {
      setFormError(t("profileManagement.errors.saveFailed"));
    }
  };

  const askDelete = () => {
    if (!editing) return;
    setDeleteError(null);
    setConfirmDelete(editing);
    // Close the form so the confirm appears on a clean surface.
    setEditing(null);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setConfirmDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleteError(null);
    try {
      await deleteProfile.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError(t("profileManagement.errors.cannotDeleteLast"));
      } else {
        setDeleteError(t("profileManagement.errors.deleteFailed"));
      }
    }
  };

  return (
    <AuthShell>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 3, sm: 4.5 },
          py: 3.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Logo size={22} />
          <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
            HomeFlix
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          gap: { xs: 5, sm: 7 },
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 32, sm: 48 },
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            textAlign: "center",
            color: inkAlpha(0.92),
          }}
        >
          {t("profileManagement.manageTitle")}
        </Typography>

        {profilesQuery.isLoading ? (
          <CircularProgress sx={{ color: "primary.main" }} />
        ) : (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: { xs: 3, sm: 5 },
              width: "100%",
              maxWidth: 880,
            }}
          >
            {profiles.map((profile) => (
              <ProfileTile
                key={profile.id}
                profile={profile}
                onClick={() => openEdit(profile)}
                disabled={submitting || deleting}
              />
            ))}
            <NewProfileTile onClick={openCreate} disabled={submitting || deleting} />
          </Box>
        )}
      </Box>

      <Box sx={{ px: 3, pb: { xs: 3, sm: 5 }, display: "flex", justifyContent: "center" }}>
        <Button
          onClick={handleDone}
          variant="outlined"
          sx={{
            width: "100%",
            maxWidth: 480,
            py: 1.5,
            borderColor: whiteAlpha(0.15),
            color: "text.primary",
            textTransform: "none",
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.02em",
            "&:hover": {
              borderColor: whiteAlpha(0.3),
              bgcolor: whiteAlpha(0.04),
            },
          }}
        >
          {t("profileManagement.done")}
        </Button>
      </Box>

      <ProfileFormDialog
        // Remount on target switch so initial state always
        // reflects the current target (lazy useState from props).
        key={editing?.id ?? (creating ? "create" : "closed")}
        open={dialogOpen}
        profile={editing}
        libraries={libraries ?? []}
        submitting={submitting}
        error={formError}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onDelete={editing ? askDelete : undefined}
      />

      <Dialog
        open={confirmDelete !== null}
        onClose={cancelDelete}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("profileManagement.deleteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("profileManagement.deleteConfirm", {
              name: confirmDelete?.name ?? "",
            })}
          </DialogContentText>
          {deleteError && (
            <Typography
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(error.main, 0.08),
                border: `1px solid ${alpha(error.main, 0.25)}`,
                color: alpha(error.light, 0.95),
                fontSize: 13,
              }}
            >
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} disabled={deleting} color="inherit">
            {t("profileManagement.actions.cancel")}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            disabled={deleting}
            color="error"
            variant="contained"
          >
            {t("profileManagement.actions.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </AuthShell>
  );
}

interface ProfileTileProps {
  profile: Profile;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * One tile in the manage grid. Hovering reveals a translateY lift
 * + peach border on the avatar (mirrors the picker), and a small
 * pencil overlay sits on the bottom-right corner of the avatar to
 * signal the edit affordance. Clicking anywhere on the tile (the
 * avatar OR the pencil) opens the form — the pencil is purely a
 * visual hint.
 */
function ProfileTile({ profile, onClick, disabled = false }: ProfileTileProps) {
  const [hover, setHover] = useState(false);
  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      disabled={disabled}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        color: "text.primary",
        opacity: disabled ? 0.6 : 1,
        transform: hover && !disabled ? "translateY(-2px)" : "none",
        transition: "transform 200ms ease",
      }}
    >
      <Box sx={{ position: "relative" }}>
        <Avatar
          initials={initialsForName(profile.name)}
          tone={toneForProfile(profile.id)}
          avatarUrl={profile.avatar_url}
          size={120}
          shape="rounded"
          ring={hover && !disabled}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: 32,
            height: 32,
            borderRadius: "50%",
            bgcolor: "background.default",
            border: `1px solid ${whiteAlpha(0.15)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: hover ? "primary.main" : "text.secondary",
            transition: "color 200ms ease",
          }}
        >
          <Pencil size={14} />
        </Box>
      </Box>
      <Typography
        sx={{
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          color: hover && !disabled
            ? inkAlpha(0.92)
            : inkAlpha(0.6),
          transition: "color 200ms ease",
        }}
      >
        {profile.name}
      </Typography>
    </ButtonBase>
  );
}

interface NewProfileTileProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * The "+ New Profile" tile mirrors the avatar geometry so the
 * row reads as a single rhythm of rounded-square tiles.
 */
function NewProfileTile({ onClick, disabled = false }: NewProfileTileProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      disabled={disabled}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        color: "text.primary",
        opacity: disabled ? 0.6 : 1,
        transform: hover && !disabled ? "translateY(-3px)" : "none",
        transition: "transform 200ms ease",
      }}
      aria-label={t("profileManagement.addProfile")}
    >
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: `${Math.round(120 * 0.16)}px`,
          border: `1.5px solid ${
            hover && !disabled ? peachAlpha(0.6) : whiteAlpha(0.2)
          }`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: hover && !disabled ? "primary.main" : whiteAlpha(0.5),
          transition: "all 200ms ease",
        }}
      >
        <Plus size={42} />
      </Box>
      <Typography
        sx={{
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          color: hover && !disabled
            ? inkAlpha(0.92)
            : inkAlpha(0.6),
          transition: "color 200ms ease",
        }}
      >
        {t("profileManagement.addProfile")}
      </Typography>
    </ButtonBase>
  );
}
