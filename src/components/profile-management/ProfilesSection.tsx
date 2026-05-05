import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  useCreateProfile,
  useDeleteProfile,
  useProfiles,
  useUpdateProfile,
} from "../../api/auth";
import { useLibraries } from "../../api/hooks";
import type { Profile } from "../../api/types";
import { ProfileFormDialog, type ProfileFormSubmit } from "./ProfileFormDialog";
import { ProfileRow } from "./ProfileRow";

/**
 * Settings → Profiles section. Owns the create / edit / delete
 * lifecycle for the household's profiles, including the confirm
 * dialog for delete (the backend returns 409 when the user tries
 * to delete their last profile — surfaced as a friendly inline
 * error rather than a raw status code).
 *
 * The section sits in ``Settings.tsx`` with id ``profiles`` so
 * other places that link here (the picker's "+ Gerenciar perfis"
 * link, the AccountMenu's "Gerenciar perfis" item) can scroll
 * directly to it via ``/settings#profiles``.
 */
export function ProfilesSection() {
  const { t } = useTranslation();
  const profilesQuery = useProfiles();
  const { data: libraries } = useLibraries();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();

  const [editing, setEditing] = useState<Profile | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const profiles = profilesQuery.data ?? [];
  const submitting = createProfile.isPending || updateProfile.isPending;
  const deleting = deleteProfile.isPending;

  const handleOpenCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (profile: Profile) => {
    setEditing(profile);
    setFormError(null);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    if (submitting) return;
    setFormOpen(false);
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
      setFormOpen(false);
    } catch {
      setFormError(t("profileManagement.errors.saveFailed"));
    }
  };

  const handleAskDelete = (profile: Profile) => {
    setDeleteError(null);
    setConfirmDelete(profile);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleteError(null);
    try {
      await deleteProfile.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      // Backend returns 409 when this is the last profile and the
      // delete would leave the user with none. Surface as a friendly
      // message rather than the generic "couldn't save" copy.
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError(t("profileManagement.errors.cannotDeleteLast"));
      } else {
        setDeleteError(t("profileManagement.errors.deleteFailed"));
      }
    }
  };

  return (
    <>
      {profilesQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          {profiles.length === 0 ? (
            <Box sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">
                {t("profileManagement.empty")}
              </Typography>
            </Box>
          ) : (
            profiles.map((profile, idx) => (
              <Box key={profile.id}>
                {idx > 0 && <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.06)" }} />}
                <ProfileRow
                  profile={profile}
                  onEdit={handleOpenEdit}
                  onDelete={handleAskDelete}
                  disabled={submitting || deleting}
                />
              </Box>
            ))
          )}

          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.06)" }} />
          <Box sx={{ p: 2.5 }}>
            <Button
              startIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
              variant="outlined"
              fullWidth
              disabled={submitting || deleting}
              sx={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
            >
              {t("profileManagement.addProfile")}
            </Button>
          </Box>
        </>
      )}

      <ProfileFormDialog
        // Remount on target switch so initial state always
        // reflects the current ``editing`` value — keeps the
        // dialog free of a useEffect-driven reset (lint:
        // ``react-hooks/set-state-in-effect``).
        key={editing?.id ?? "create"}
        open={formOpen}
        profile={editing}
        libraries={libraries ?? []}
        submitting={submitting}
        error={formError}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
      />

      <Dialog
        open={confirmDelete !== null}
        onClose={() => !deleting && setConfirmDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("profileManagement.deleteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("profileManagement.deleteConfirm", { name: confirmDelete?.name ?? "" })}
          </DialogContentText>
          {deleteError && (
            <Typography
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: "rgba(248, 113, 113, 0.08)",
                border: "1px solid rgba(248, 113, 113, 0.25)",
                color: "rgba(252, 165, 165, 0.95)",
                fontSize: 13,
              }}
            >
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDelete(null)}
            disabled={deleting}
            color="inherit"
          >
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
    </>
  );
}
