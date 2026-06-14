import { alpha } from "@mui/material/styles";
import {
  Alert,
  Box,
  Checkbox,
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
import {
  Bot,
  FileVideo,
  GitMerge,
  Layers,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  useAdminConflicts,
  useBulkMarkDistinctConflicts,
  useResolveAdminConflict,
  useSweepConflicts,
} from "../../api/hooks";
import type {
  AdminConflictAction,
  AdminConflictCandidateFile,
  AdminConflictCandidateSummary,
  AdminConflictResolutionSource,
  AdminConflictSummary,
} from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminConfirmDialog,
  AdminPageHeader,
} from "../../components/admin";
import { AdminDialog } from "../../components/admin/AdminDialog";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { inkAlpha, status, whiteAlpha } from "../../theme/tokens";

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

type Snack = { message: string; severity: "success" | "error" } | null;

type DialogState =
  | { open: false }
  | { open: true; conflict: AdminConflictSummary };

type TabKey = "pending" | "manual" | "auto";

const TAB_DEFINITIONS: ReadonlyArray<{
  key: TabKey;
  state: "pending" | "resolved";
  source: AdminConflictResolutionSource | null;
  labelKey: string;
}> = [
  { key: "pending", state: "pending", source: null, labelKey: "admin.conflicts.tabs.pending" },
  { key: "manual", state: "resolved", source: "manual", labelKey: "admin.conflicts.tabs.manual" },
  { key: "auto", state: "resolved", source: "auto", labelKey: "admin.conflicts.tabs.auto" },
];

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

  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const activeTabDef =
    TAB_DEFINITIONS.find((d) => d.key === activeTab) ?? TAB_DEFINITIONS[0];

  const paged = useAdminConflicts({
    state: activeTabDef.state,
    source: activeTabDef.source,
  });
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [snack, setSnack] = useState<Snack>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulk = useBulkMarkDistinctConflicts();
  const [sweepConfirmOpen, setSweepConfirmOpen] = useState(false);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const sweep = useSweepConflicts();

  const isAuditView = activeTab !== "pending";

  const changeTab = (key: TabKey) => {
    setActiveTab(key);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openResolveDialog = (conflict: AdminConflictSummary) =>
    setDialog({ open: true, conflict });
  const closeResolveDialog = () => setDialog({ open: false });

  const notifySuccess = (message: string) =>
    setSnack({ message, severity: "success" });
  const notifyError = (message: string) =>
    setSnack({ message, severity: "error" });

  const confirmSweep = async () => {
    setSweepError(null);
    try {
      const result = await sweep.mutateAsync();
      setSweepConfirmOpen(false);
      notifySuccess(
        result.conflicts_created > 0
          ? t("admin.conflicts.sweep.snack.found", {
              scanned: result.movies_scanned,
              created: result.conflicts_created,
            })
          : t("admin.conflicts.sweep.snack.clean", {
              scanned: result.movies_scanned,
            }),
      );
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.conflicts.snack.failed");
      setSweepError(msg);
      notifyError(msg);
    }
  };

  const confirmBulkMarkDistinct = async () => {
    setBulkError(null);
    try {
      const result = await bulk.mutateAsync([...selectedIds]);
      setBulkConfirmOpen(false);
      setSelectedIds(new Set());
      const skipped = result.skipped.length;
      notifySuccess(
        skipped > 0
          ? t("admin.conflicts.bulk.snack.partial", {
              resolved: result.resolved_ids.length,
              skipped,
            })
          : t("admin.conflicts.bulk.snack.done", {
              count: result.resolved_ids.length,
            }),
      );
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("admin.conflicts.snack.failed");
      setBulkError(msg);
      notifyError(msg);
    }
  };

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.conflicts")]}
        title={t("admin.conflicts.title")}
        subtitle={t("admin.conflicts.subtitle")}
      />

      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2.5 }}
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1}>
          {TAB_DEFINITIONS.map((def) => (
            <AdminButton
              key={def.key}
              variant={activeTab === def.key ? "primary" : "ghost"}
              onClick={() => changeTab(def.key)}
            >
              {t(def.labelKey)}
            </AdminButton>
          ))}
        </Stack>
        <AdminButton
          variant="secondary"
          icon={<RefreshCw size={14} />}
          onClick={() => {
            setSweepError(null);
            setSweepConfirmOpen(true);
          }}
          disabled={sweep.isPending}
        >
          {sweep.isPending
            ? t("admin.conflicts.sweep.running")
            : t("admin.conflicts.sweep.button")}
        </AdminButton>
      </Stack>

      {!isAuditView && selectedIds.size > 0 && (
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
          sx={{
            mb: 2,
            px: 2,
            py: 1.25,
            borderRadius: 1,
            bgcolor: "rgba(120,160,255,0.08)",
            border: "1px solid rgba(120,160,255,0.2)",
          }}
        >
          <Typography variant="body2" sx={{ color: inkAlpha(0.85) }}>
            {t("admin.conflicts.bulk.selected", { count: selectedIds.size })}
          </Typography>
          <Stack direction="row" spacing={1}>
            <AdminButton variant="ghost" onClick={() => setSelectedIds(new Set())}>
              {t("admin.conflicts.bulk.clear")}
            </AdminButton>
            <AdminButton
              variant="primary"
              icon={<ListChecks size={14} />}
              onClick={() => {
                setBulkError(null);
                setBulkConfirmOpen(true);
              }}
            >
              {t("admin.conflicts.bulk.markDistinct")}
            </AdminButton>
          </Stack>
        </Stack>
      )}

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
            <ShieldCheck size={28} color={inkAlpha(0.4)} />
            <Typography variant="body1" sx={{ color: inkAlpha(0.85) }}>
              {t(
                isAuditView
                  ? "admin.conflicts.empty.auditTitle"
                  : "admin.conflicts.empty.title",
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: inkAlpha(0.55) }}>
              {t(
                isAuditView
                  ? "admin.conflicts.empty.auditSubtitle"
                  : "admin.conflicts.empty.subtitle",
              )}
            </Typography>
          </Stack>
        </AdminCard>
      ) : (
        <Stack spacing={2.5}>
          {paged.items.map((conflict) => (
            <ConflictRow
              key={conflict.conflict_id}
              conflict={conflict}
              selectable={!isAuditView}
              selected={selectedIds.has(conflict.conflict_id)}
              onToggleSelect={() => toggleSelect(conflict.conflict_id)}
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

      <AdminConfirmDialog
        open={bulkConfirmOpen}
        title={t("admin.conflicts.bulk.dialog.title")}
        body={t("admin.conflicts.bulk.dialog.body", { count: selectedIds.size })}
        consequences={[
          t("admin.conflicts.bulk.dialog.consequence1"),
          t("admin.conflicts.bulk.dialog.consequence2"),
        ]}
        busy={bulk.isPending}
        errorMessage={bulkError}
        confirmLabel={t("admin.conflicts.bulk.markDistinct")}
        confirmingLabel={t("admin.confirm.confirming")}
        cancelLabel={t("admin.confirm.cancel")}
        onCancel={() => {
          if (!bulk.isPending) setBulkConfirmOpen(false);
        }}
        onConfirm={confirmBulkMarkDistinct}
      />

      <AdminConfirmDialog
        open={sweepConfirmOpen}
        title={t("admin.conflicts.sweep.dialog.title")}
        body={t("admin.conflicts.sweep.dialog.body")}
        consequences={[
          t("admin.conflicts.sweep.dialog.consequence1"),
          t("admin.conflicts.sweep.dialog.consequence2"),
        ]}
        busy={sweep.isPending}
        errorMessage={sweepError}
        confirmLabel={t("admin.conflicts.sweep.button")}
        confirmingLabel={t("admin.conflicts.sweep.running")}
        cancelLabel={t("admin.confirm.cancel")}
        onCancel={() => {
          if (!sweep.isPending) setSweepConfirmOpen(false);
        }}
        onConfirm={confirmSweep}
      />

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
                  ? alpha(status.ok.base, 0.15)
                  : alpha(status.err.base, 0.18),
              border: `1px solid ${whiteAlpha(0.08)}`,
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
  selectable = false,
  selected = false,
  onToggleSelect,
  onResolveClick,
}: {
  conflict: AdminConflictSummary;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onResolveClick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const detected = useMemo(
    () => new Date(conflict.detected_at).toLocaleString(i18n.language),
    [conflict.detected_at, i18n.language],
  );
  const resolvedAt = useMemo(
    () =>
      conflict.resolved_at
        ? new Date(conflict.resolved_at).toLocaleString(i18n.language)
        : null,
    [conflict.resolved_at, i18n.language],
  );
  const suggestedTone =
    conflict.suggested_action === "different_edit_suspected" ? "warn" : "info";
  const isResolved = conflict.resolved_at !== null;
  const winner =
    conflict.winner_id === conflict.candidate_a.media_id
      ? conflict.candidate_a
      : conflict.winner_id === conflict.candidate_b.media_id
        ? conflict.candidate_b
        : null;

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
            {selectable && (
              <Checkbox
                size="small"
                checked={selected}
                onChange={onToggleSelect}
                sx={{ p: 0.5, color: inkAlpha(0.45) }}
                inputProps={{
                  "aria-label": t("admin.conflicts.bulk.selectRow"),
                }}
              />
            )}
            <Layers size={16} color={inkAlpha(0.55)} />
            <Typography variant="subtitle2" sx={{ color: inkAlpha(0.78) }}>
              {t("admin.conflicts.matchReason." + conflict.match_reason)}
            </Typography>
            <AdminBadge tone={suggestedTone}>
              {t("admin.conflicts.suggestedAction." + conflict.suggested_action)}
            </AdminBadge>
          </Stack>
          <Typography variant="caption" sx={{ color: inkAlpha(0.45) }}>
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
          <Typography variant="caption" sx={{ color: inkAlpha(0.5) }}>
            {t("admin.conflicts.runtimeDelta", {
              minutes: conflict.runtime_delta_minutes.toFixed(1),
            })}
          </Typography>
        )}

        {isResolved ? (
          <ResolvedFooter
            conflict={conflict}
            winner={winner}
            resolvedAt={resolvedAt}
          />
        ) : (
          <Stack direction="row" justifyContent="flex-end">
            <AdminButton
              variant="primary"
              icon={<GitMerge size={14} />}
              onClick={onResolveClick}
            >
              {t("admin.conflicts.action.resolve")}
            </AdminButton>
          </Stack>
        )}
      </Stack>
    </AdminCard>
  );
}

function ResolvedFooter({
  conflict,
  winner,
  resolvedAt,
}: {
  conflict: AdminConflictSummary;
  winner: AdminConflictCandidateSummary | null;
  resolvedAt: string | null;
}) {
  const { t } = useTranslation();
  if (!conflict.resolution) return null;

  const sourceLabel =
    conflict.resolution_source === "auto"
      ? t("admin.conflicts.resolved.byAuto")
      : t("admin.conflicts.resolved.byAdmin");
  const sourceIcon =
    conflict.resolution_source === "auto" ? (
      <Bot size={12} />
    ) : (
      <UserCheck size={12} />
    );
  const sourceTone = conflict.resolution_source === "auto" ? "info" : "neutral";

  const isMarkDistinct = conflict.resolution === "mark_distinct";

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.25}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", md: "center" }}
      sx={{
        bgcolor: whiteAlpha(0.02),
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
        px: 1.75,
        py: 1.25,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
        <AdminBadge tone={sourceTone} icon={sourceIcon}>
          {sourceLabel}
        </AdminBadge>
        <Typography variant="body2" sx={{ color: inkAlpha(0.78) }}>
          {t("admin.conflicts.action." + conflict.resolution)}
        </Typography>
        {!isMarkDistinct && winner && (
          <Typography
            variant="caption"
            sx={{ color: inkAlpha(0.55) }}
          >
            {t("admin.conflicts.resolved.winnerWas", {
              title:
                winner.title ?? t("admin.conflicts.candidate.missingTitle"),
            })}
          </Typography>
        )}
      </Stack>
      {resolvedAt && (
        <Typography variant="caption" sx={{ color: inkAlpha(0.45) }}>
          {t("admin.conflicts.resolved.at", { when: resolvedAt })}
        </Typography>
      )}
    </Stack>
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
        bgcolor: whiteAlpha(0.02),
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          display: "block",
          color: inkAlpha(0.45),
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
        sx={{ color: inkAlpha(0.55), fontFamily: "monospace" }}
      >
        {candidate.media_id}
        {candidate.year ? ` · ${candidate.year}` : ""}
      </Typography>

      {candidate.files.length > 0 ? (
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          {candidate.files.map((file) => (
            <CandidateFileRow key={file.file_path} file={file} />
          ))}
        </Stack>
      ) : (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 1.25, color: inkAlpha(0.4) }}
        >
          {t("admin.conflicts.candidate.noFiles")}
        </Typography>
      )}
    </Box>
  );
}

function CandidateFileRow({ file }: { file: AdminConflictCandidateFile }) {
  const { t } = useTranslation();
  const meta = [file.resolution, formatBytes(file.file_size)];
  if (file.video_codec) meta.push(file.video_codec);
  if (file.hdr_format) meta.push(file.hdr_format);

  return (
    <Box sx={{ borderTop: `1px solid ${whiteAlpha(0.05)}`, pt: 0.75 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
        <FileVideo size={12} color={inkAlpha(0.45)} />
        <Typography variant="caption" sx={{ color: inkAlpha(0.7) }}>
          {meta.join(" · ")}
        </Typography>
        {file.is_primary && (
          <AdminBadge tone="ok">{t("admin.conflicts.candidate.primary")}</AdminBadge>
        )}
      </Stack>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          color: inkAlpha(0.45),
          fontFamily: "monospace",
          wordBreak: "break-all",
        }}
      >
        {file.file_path}
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
      <Typography variant="caption" sx={{ color: inkAlpha(0.5) }}>
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
          <Typography variant="body2" sx={{ color: inkAlpha(0.72) }}>
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
      <Typography variant="caption" sx={{ color: inkAlpha(0.55) }}>
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
        sx={{ color: inkAlpha(0.55), fontFamily: "monospace" }}
      >
        {candidate.media_id}
        {candidate.year ? ` · ${candidate.year}` : ""}
      </Typography>
    </Box>
  );
}
