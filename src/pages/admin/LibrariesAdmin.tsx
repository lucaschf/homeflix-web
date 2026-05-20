import { Box, IconButton, Snackbar, Stack, Tooltip, Typography } from "@mui/material";
import { Library as LibraryIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDeleteLibrary, useLibraries } from "../../api/hooks";
import type { Library } from "../../api/types";
import { ApiError } from "../../api/client";
import {
  AdminBadge,
  AdminButton,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminTable,
  type AdminTableColumn,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type Snack = { message: string; severity: "success" | "error" } | null;

/**
 * Admin Libraries list. One row per library with paths, provider
 * badges, item totals, and per-row edit / delete actions. The
 * primary CTA navigates to the create form; row click jumps to
 * the matching detail page.
 */
export function LibrariesAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.libraries.title"));

  const { data: libraries, isLoading, isError, refetch } = useLibraries();
  const remove = useDeleteLibrary();
  const [pendingDelete, setPendingDelete] = useState<Library | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(pendingDelete.id);
      setSnack({
        message: t("admin.libraries.snack.deleteSuccess", { name: pendingDelete.name }),
        severity: "success",
      });
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : t("admin.libraries.snack.deleteFailed"),
      );
    }
  };

  const columns = useMemo<AdminTableColumn<Library>[]>(
    () => [
      {
        id: "name",
        label: t("admin.libraries.col.name"),
        render: (lib) => (
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 0.75,
                bgcolor: "rgba(217,119,87,0.10)",
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <LibraryIcon size={15} aria-hidden />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500} noWrap>
                {lib.name}
              </Typography>
              <Typography variant="metaMono" color="text.secondary">
                {lib.id}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        id: "paths",
        label: t("admin.libraries.col.paths"),
        render: (lib) => (
          <Stack
            spacing={0.25}
            sx={{
              maxWidth: 360,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: "0.78125rem",
              color: "text.secondary",
            }}
          >
            {lib.paths.slice(0, 3).map((p) => (
              <Box
                key={p}
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={p}
              >
                {p}
              </Box>
            ))}
            {lib.paths.length > 3 && (
              <Box sx={{ color: "text.disabled" }}>
                {t("admin.libraries.morePaths", { count: lib.paths.length - 3 })}
              </Box>
            )}
          </Stack>
        ),
      },
      {
        id: "providers",
        label: t("admin.libraries.col.provider"),
        width: "180px",
        render: (lib) => (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {lib.metadata_providers.length === 0 ? (
              <Typography variant="caption" color="text.disabled">
                —
              </Typography>
            ) : (
              lib.metadata_providers
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((p) => (
                  <AdminBadge key={p.provider} tone={p.enabled ? "neutral" : "warn"}>
                    {p.provider}
                  </AdminBadge>
                ))
            )}
          </Stack>
        ),
      },
      {
        id: "items",
        label: t("admin.libraries.col.items"),
        width: "100px",
        align: "right",
        mono: true,
        muted: true,
        render: (lib) => {
          const movies = lib.movie_count ?? 0;
          const series = lib.series_count ?? 0;
          if (lib.library_type === "movies") return String(movies);
          if (lib.library_type === "series") return String(series);
          return String(movies + series);
        },
      },
      {
        id: "lastScan",
        label: t("admin.libraries.col.lastScan"),
        width: "140px",
        muted: true,
        render: (lib) =>
          lib.last_scan_at ? new Date(lib.last_scan_at).toLocaleDateString() : "—",
      },
      {
        id: "actions",
        label: "",
        width: "100px",
        align: "right",
        render: (lib) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title={t("admin.libraries.action.edit")}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/libraries/${lib.id}`);
                }}
                sx={{ color: "text.secondary" }}
              >
                <Pencil size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("admin.libraries.action.delete")}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(lib);
                  setDeleteError(null);
                }}
                sx={{ color: "#ff8a7a" }}
              >
                <Trash2 size={15} />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [navigate, t],
  );

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.libraries")]}
        title={t("admin.libraries.title")}
        subtitle={t("admin.libraries.subtitle")}
        primaryCTA={
          <AdminButton
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => navigate("/admin/libraries/new")}
          >
            {t("admin.libraries.newCta")}
          </AdminButton>
        }
      />

      <AdminTable
        columns={columns}
        rows={libraries}
        rowKey="id"
        loading={isLoading}
        error={isError ? t("admin.libraries.errorLoading") : undefined}
        onRetry={() => void refetch()}
        onRowClick={(lib) => navigate(`/admin/libraries/${lib.id}`)}
        emptyState={
          <AdminEmptyState
            icon={LibraryIcon}
            title={t("admin.libraries.emptyTitle")}
            body={t("admin.libraries.emptyBody")}
            cta={
              <AdminButton
                variant="primary"
                icon={<Plus size={15} />}
                onClick={() => navigate("/admin/libraries/new")}
              >
                {t("admin.libraries.newCta")}
              </AdminButton>
            }
          />
        }
      />

      <AdminConfirmDialog
        open={!!pendingDelete}
        title={t("admin.libraries.delete.title", { name: pendingDelete?.name ?? "" })}
        body={t("admin.libraries.delete.body")}
        consequences={[
          t("admin.libraries.delete.consequenceUnindex"),
          t("admin.libraries.delete.consequenceFiles"),
          t("admin.libraries.delete.consequenceRefs"),
        ]}
        danger
        busy={remove.isPending}
        errorMessage={deleteError}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
        confirmLabel={t("admin.libraries.delete.confirm")}
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
