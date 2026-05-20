import { Box, IconButton, Snackbar, Tooltip, Typography } from "@mui/material";
import { ExternalLink, Inbox, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAdminCatalogRequests,
  useDismissCatalogRequest,
  usePagedList,
} from "../../api/hooks";
import type { CatalogRequest } from "../../api/types";
import { ApiError } from "../../api/client";
import {
  AdminBadge,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminTable,
  AdminTablePagination,
  type AdminTableColumn,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type Snack = { message: string; severity: "success" | "error" } | null;

const TMDB_BASE = "https://www.themoviedb.org";

function tmdbUrl(request: CatalogRequest): string {
  const kind = request.media_type === "movie" ? "movie" : "tv";
  return `${TMDB_BASE}/${kind}/${request.tmdb_id}`;
}

/**
 * Admin Catalog Requests page — surveys every TMDB title the
 * household has flagged for inclusion (the "Solicitar inclusão"
 * affordance on the Collection Detail page) plus notification
 * subscriptions.
 *
 * Each row links out to TMDB so the operator can verify the title
 * before either tracking it down externally or dismissing the
 * request from the queue.
 */
export function CatalogRequestsAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.requests.title"));

  const { data, isLoading, isError, refetch } = useAdminCatalogRequests();
  const dismiss = useDismissCatalogRequest();
  const [pageSize, setPageSize] = useState(10);
  const allRows = data ?? [];
  const paged = usePagedList<CatalogRequest>(allRows, pageSize);
  const [pendingDismiss, setPendingDismiss] = useState<CatalogRequest | null>(null);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  const onConfirmDismiss = async () => {
    if (!pendingDismiss) return;
    setDismissError(null);
    try {
      await dismiss.mutateAsync(pendingDismiss.id);
      setSnack({
        message: t("admin.requests.snack.dismissSuccess", {
          tmdbId: pendingDismiss.tmdb_id,
        }),
        severity: "success",
      });
      setPendingDismiss(null);
    } catch (err) {
      setDismissError(
        err instanceof ApiError
          ? err.message
          : t("admin.requests.snack.dismissFailed"),
      );
    }
  };

  const columns: AdminTableColumn<CatalogRequest>[] = [
    {
      id: "title",
      label: t("admin.requests.col.title"),
      render: (r) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: r.title ? "text.primary" : "text.secondary",
              fontStyle: r.title ? "normal" : "italic",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.title ?? t("admin.requests.untitled")}
          </Typography>
          <Typography
            variant="metaMono"
            component="a"
            href={tmdbUrl(r)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{
              color: "primary.main",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              mt: 0.25,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {r.media_type === "movie" ? "movie" : "tv"}/{r.tmdb_id}
            <ExternalLink size={11} aria-hidden />
          </Typography>
        </Box>
      ),
    },
    {
      id: "media_type",
      label: t("admin.requests.col.type"),
      width: "110px",
      render: (r) => (
        <AdminBadge tone={r.media_type === "movie" ? "info" : "peach"}>
          {t(`admin.requests.mediaType.${r.media_type}`)}
        </AdminBadge>
      ),
    },
    {
      id: "collection",
      label: t("admin.requests.col.collection"),
      width: "150px",
      mono: true,
      muted: true,
      render: (r) =>
        r.collection_tmdb_id ? (
          <Box
            component="a"
            href={`${TMDB_BASE}/collection/${r.collection_tmdb_id}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{
              color: "primary.main",
              textDecoration: "none",
              fontFamily: "inherit",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            collection/{r.collection_tmdb_id}
          </Box>
        ) : (
          "—"
        ),
    },
    {
      id: "notify",
      label: t("admin.requests.col.notify"),
      width: "120px",
      render: (r) =>
        r.notify_on_arrival ? (
          <AdminBadge tone="ok">{t("admin.requests.notify.on")}</AdminBadge>
        ) : (
          <Typography variant="caption" color="text.disabled">
            {t("admin.requests.notify.off")}
          </Typography>
        ),
    },
    {
      id: "requested_at",
      label: t("admin.requests.col.requestedAt"),
      width: "140px",
      muted: true,
      render: (r) => new Date(r.requested_at).toLocaleDateString(),
    },
    {
      id: "actions",
      label: "",
      width: "60px",
      align: "right",
      render: (r) => (
        <Tooltip title={t("admin.requests.action.dismiss")}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setPendingDismiss(r);
              setDismissError(null);
            }}
            sx={{ color: "#ff8a7a" }}
          >
            <Trash2 size={15} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.requests")]}
        title={t("admin.requests.title")}
        subtitle={t("admin.requests.subtitle")}
      />

      <AdminTable
        columns={columns}
        rows={paged.items}
        rowKey="id"
        loading={isLoading}
        error={isError ? t("admin.requests.errorLoading") : undefined}
        onRetry={() => void refetch()}
        emptyState={
          <AdminEmptyState
            icon={Inbox}
            title={t("admin.requests.emptyTitle")}
            body={t("admin.requests.emptyBody")}
          />
        }
      />

      {allRows.length > pageSize && (
        <AdminTablePagination
          pageNumber={paged.pageNumber}
          canGoNext={paged.canGoNext}
          canGoPrevious={paged.canGoPrevious}
          onNext={paged.goNext}
          onPrevious={paged.goPrevious}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      )}

      <AdminConfirmDialog
        open={!!pendingDismiss}
        title={t("admin.requests.dismiss.title", {
          tmdbId: pendingDismiss?.tmdb_id ?? "",
        })}
        body={t("admin.requests.dismiss.body")}
        consequences={[
          t("admin.requests.dismiss.consequenceQueue"),
          t("admin.requests.dismiss.consequenceNotify"),
          t("admin.requests.dismiss.consequenceRecreatable"),
        ]}
        danger
        busy={dismiss.isPending}
        errorMessage={dismissError}
        onCancel={() => {
          setPendingDismiss(null);
          setDismissError(null);
        }}
        onConfirm={onConfirmDismiss}
        confirmLabel={t("admin.requests.dismiss.confirm")}
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
