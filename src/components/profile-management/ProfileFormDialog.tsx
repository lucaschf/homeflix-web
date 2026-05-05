import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
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
import { useTranslation } from "react-i18next";
import type { CreateProfileInput, Library, Profile } from "../../api/types";

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
              bgcolor: "rgba(248, 113, 113, 0.08)",
              border: "1px solid rgba(248, 113, 113, 0.25)",
              color: "rgba(252, 165, 165, 0.95)",
              fontSize: 13,
            }}
          >
            {error}
          </Typography>
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

        <Divider sx={{ my: 3, borderColor: "rgba(255, 255, 255, 0.08)" }} />

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
            <Divider sx={{ my: 2, borderColor: "rgba(255, 255, 255, 0.08)" }} />
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
      <DialogActions>
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
      </DialogActions>
    </Dialog>
  );
}

export type { CreateProfileInput };
