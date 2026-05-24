import {
  Alert,
  Box,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { GitMerge, Layers, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useAdminConflicts, useResolveAdminConflict } from "../../api/hooks";
import type {
  AdminConflictAction,
  AdminConflictCandidateSummary,
  AdminConflictSummary,
} from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminPageHeader,
} from "../../components/admin";
import { AdminDialog } from "../../components/admin/AdminDialog";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type Snack = { message: string; severity: "success" | "error" } | null;

type DialogState =
  | { open: false }
  | { open: true; conflict: AdminConflictSummary };

/**
 * Admin conflict queue (ADR-015 Phase 2).
 *
 * Lists pending content-identity conflicts queued by the post-enrich
 * detector. For each row the operator picks a disposition:
 *
 * - ``mark_distinct`` — these really are different editions; the
 *   detector won't re-queue the pair on future enrichment passes.
 * - ``merge_replace`` — soft-deletes the loser movie; downstream
 *   cross-BC handlers drop the loser's watch progress and repoint
 *   watchlist / custom-list entries to the winner.
 * - ``merge_keep_both`` — same as ``merge_replace`` plus the loser's
 *   file variants move onto the winner so the player can pick the
 *   best stream at playback time.
 */
export function ConflictsAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.conflicts.title"));

  const paged = useAdminConflicts();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [snack, setSnack] = useState<Snack>(null);

  const openResolveDialog = (conflict: AdminConflictSummary) =>
    setDialog({ open: true, conflict });
  const closeResolveDialog = () => setDialog({ open: false });

  const notifySuccess = (message: string) =>
    setSnack({ message, severity: "success" });
  const notifyError = (message: string) =>
    setSnack({ message, severity: "error" });

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.conflicts")]}
        title={t("admin.conflicts.title")}
        subtitle={t("admin.conflicts.subtitle")}
      />

      {paged.isLoading && !paged.items.length ? (
        <AdminCard>
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={22} color="primary" />
          </Box>
        </AdminCard>
      ) : paged.isError ? (
        <AdminCard>
          <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
            <Typography variant="body2" color="error">
              {t("admin.conflicts.errorLoading")}
            </Typography>
            <AdminButton variant="secondary" onClick={() => paged.refetch()}>
              {t("admin.table.retry")}
            </AdminButton>
          </Stack>
        </AdminCard>
      ) : paged.items.length === 0 ? (
        <AdminCard>
          <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
            <ShieldCheck size={28} color="rgba(245,241,235,0.4)" />
            <Typography variant="body1" sx={{ color: "rgba(245,241,235,0.85)" }}>
              {t("admin.conflicts.empty.title")}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(245,241,235,0.55)" }}>
              {t("admin.conflicts.empty.subtitle")}
            </Typography>
          </Stack>
        </AdminCard>
      ) : (
        <Stack spacing={2.5}>
          {paged.items.map((conflict) => (
            <ConflictRow
              key={conflict.conflict_id}
              conflict={conflict}
              onResolveClick={() => openResolveDialog(conflict)}
            />
          ))}
          <PaginationRow
            pageNumber={paged.pageNumber}
            canGoPrevious={paged.canGoPrevious}
            canGoNext={paged.canGoNext}
            isFetching={paged.isFetching}
            onPrevious={paged.goPrevious}
            onNext={paged.goNext}
          />
        </Stack>
      )}

      {dialog.open && (
        <ResolveConflictDialog
          conflict={dialog.conflict}
          onClose={closeResolveDialog}
          onResolved={(message) => {
            notifySuccess(message);
            closeResolveDialog();
          }}
          onFailed={notifyError}
        />
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Box
            sx={{
              bgcolor:
                snack.severity === "success"
                  ? "rgba(80,180,120,0.15)"
                  : "rgba(220,80,70,0.18)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
          >
            {snack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}

function ConflictRow({
  conflict,
  onResolveClick,
}: {
  conflict: AdminConflictSummary;
  onResolveClick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const detected = useMemo(
    () => new Date(conflict.detected_at).toLocaleString(i18n.language),
    [conflict.detected_at, i18n.language],
  );
  const suggestedTone =
    conflict.suggested_action === "different_edit_suspected" ? "warn" : "info";

  return (
    <AdminCard>
      <Stack spacing={2.25}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          spacing={1.5}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Layers size={16} color="rgba(245,241,235,0.55)" />
            <Typography variant="subtitle2" sx={{ color: "rgba(245,241,235,0.78)" }}>
              {t("admin.conflicts.matchReason." + conflict.match_reason)}
            </Typography>
            <AdminBadge tone={suggestedTone}>
              {t("admin.conflicts.suggestedAction." + conflict.suggested_action)}
            </AdminBadge>
          </Stack>
          <Typography variant="caption" sx={{ color: "rgba(245,241,235,0.45)" }}>
            {t("admin.conflicts.detectedAt", { when: detected })}
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="stretch"
        >
          <CandidatePane
            label={t("admin.conflicts.candidate.a")}
            candidate={conflict.candidate_a}
          />
          <CandidatePane
            label={t("admin.conflicts.candidate.b")}
            candidate={conflict.candidate_b}
          />
        </Stack>

        {conflict.runtime_delta_minutes !== null && (
          <Typography variant="caption" sx={{ color: "rgba(245,241,235,0.5)" }}>
            {t("admin.conflicts.runtimeDelta", {
              minutes: conflict.runtime_delta_minutes.toFixed(1),
            })}
          </Typography>
        )}

        <Stack direction="row" justifyContent="flex-end">
          <AdminButton
            variant="primary"
            icon={<GitMerge size={14} />}
            onClick={onResolveClick}
          >
            {t("admin.conflicts.action.resolve")}
          </AdminButton>
        </Stack>
      </Stack>
    </AdminCard>
  );
}

function CandidatePane({
  label,
  candidate,
}: {
  label: string;
  candidate: AdminConflictCandidateSummary;
}) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          display: "block",
          color: "rgba(245,241,235,0.45)",
          letterSpacing: "0.08em",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {candidate.title ?? t("admin.conflicts.candidate.missingTitle")}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "rgba(245,241,235,0.55)", fontFamily: "monospace" }}
      >
        {candidate.media_id}
        {candidate.year ? ` · ${candidate.year}` : ""}
      </Typography>
    </Box>
  );
}

function PaginationRow({
  pageNumber,
  canGoPrevious,
  canGoNext,
  isFetching,
  onPrevious,
  onNext,
}: {
  pageNumber: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isFetching: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack
      direction="row"
      spacing={1.25}
      justifyContent="flex-end"
      alignItems="center"
    >
      <Typography variant="caption" sx={{ color: "rgba(245,241,235,0.5)" }}>
        {t("admin.table.pagination.page", { number: pageNumber })}
      </Typography>
      <AdminButton
        variant="ghost"
        disabled={!canGoPrevious || isFetching}
        onClick={onPrevious}
      >
        {t("admin.table.pagination.previous")}
      </AdminButton>
      <AdminButton
        variant="secondary"
        disabled={!canGoNext || isFetching}
        onClick={onNext}
      >
        {t("admin.table.pagination.next")}
      </AdminButton>
    </Stack>
  );
}

function ResolveConflictDialog({
  conflict,
  onClose,
  onResolved,
  onFailed,
}: {
  conflict: AdminConflictSummary;
  onClose: () => void;
  onResolved: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [action, setAction] = useState<AdminConflictAction>("mark_distinct");
  const [winnerId, setWinnerId] = useState<string>(conflict.candidate_a.media_id);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resolve = useResolveAdminConflict();

  const isMerge =
    action === "merge_keep_both" || action === "merge_replace";

  const handleConfirm = async () => {
    setErrorMessage(null);
    try {
      const result = await resolve.mutateAsync({
        conflictId: conflict.conflict_id,
        action,
        winnerId: isMerge ? winnerId : null,
      });
      onResolved(
        t("admin.conflicts.snack.resolved", {
          action: t("admin.conflicts.action." + result.action),
        }),
      );
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : t("admin.conflicts.snack.failed");
      setErrorMessage(msg);
      onFailed(msg);
    }
  };

  return (
    <AdminDialog open onClose={resolve.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
        {t("admin.conflicts.dialog.title")}
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 1 }}>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}
        <Stack spacing={2.5}>
          <Typography variant="body2" sx={{ color: "rgba(245,241,235,0.72)" }}>
            {t("admin.conflicts.dialog.body")}
          </Typography>

          <FormControl>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              {t("admin.conflicts.dialog.actionLabel")}
            </Typography>
            <RadioGroup
              value={action}
              onChange={(_e, v) => setAction(v as AdminConflictAction)}
            >
              <FormControlLabel
                value="mark_distinct"
                control={<Radio size="small" />}
                label={
                  <ActionLabel
                    title={t("admin.conflicts.action.mark_distinct")}
                    description={t(
                      "admin.conflicts.dialog.mark_distinct.description",
                    )}
                  />
                }
              />
              <FormControlLabel
                value="merge_replace"
                control={<Radio size="small" />}
                label={
                  <ActionLabel
                    title={t("admin.conflicts.action.merge_replace")}
                    description={t(
                      "admin.conflicts.dialog.merge_replace.description",
                    )}
                  />
                }
              />
              <FormControlLabel
                value="merge_keep_both"
                control={<Radio size="small" />}
                label={
                  <ActionLabel
                    title={t("admin.conflicts.action.merge_keep_both")}
                    description={t(
                      "admin.conflicts.dialog.merge_keep_both.description",
                    )}
                  />
                }
              />
            </RadioGroup>
          </FormControl>

          {isMerge && (
            <FormControl>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                {t("admin.conflicts.dialog.winnerLabel")}
              </Typography>
              <RadioGroup
                value={winnerId}
                onChange={(_e, v) => setWinnerId(v)}
              >
                <FormControlLabel
                  value={conflict.candidate_a.media_id}
                  control={<Radio size="small" />}
                  label={
                    <CandidateRadioLabel candidate={conflict.candidate_a} />
                  }
                />
                <FormControlLabel
                  value={conflict.candidate_b.media_id}
                  control={<Radio size="small" />}
                  label={
                    <CandidateRadioLabel candidate={conflict.candidate_b} />
                  }
                />
              </RadioGroup>
            </FormControl>
          )}

          {isMerge && (
            <Alert severity="warning" variant="outlined">
              {t("admin.conflicts.dialog.irreversibleWarning")}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1.25 }}>
        <AdminButton
          onClick={onClose}
          disabled={resolve.isPending}
          variant="ghost"
        >
          {t("admin.confirm.cancel")}
        </AdminButton>
        <AdminButton
          onClick={handleConfirm}
          disabled={resolve.isPending}
          variant={isMerge ? "danger" : "primary"}
          icon={
            resolve.isPending ? (
              <CircularProgress size={14} color="inherit" />
            ) : undefined
          }
        >
          {resolve.isPending
            ? t("admin.confirm.confirming")
            : t("admin.conflicts.dialog.confirm")}
        </AdminButton>
      </DialogActions>
    </AdminDialog>
  );
}

function ActionLabel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(245,241,235,0.55)" }}>
        {description}
      </Typography>
    </Box>
  );
}

function CandidateRadioLabel({
  candidate,
}: {
  candidate: AdminConflictCandidateSummary;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {candidate.title ?? t("admin.conflicts.candidate.missingTitle")}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "rgba(245,241,235,0.55)", fontFamily: "monospace" }}
      >
        {candidate.media_id}
        {candidate.year ? ` · ${candidate.year}` : ""}
      </Typography>
    </Box>
  );
}
