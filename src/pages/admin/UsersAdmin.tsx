import {
  Box,
  DialogContent,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useCurrentUser } from "../../api/auth";
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  usePagedList,
} from "../../api/hooks";
import type { AdminUserSummary } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminConfirmDialog,
  AdminDialog,
  AdminFormSection,
  AdminInput,
  AdminPageHeader,
  AdminTable,
  AdminTablePagination,
  AdminToolbar,
  FancyEmpty,
  FilterChip,
  type AdminTableColumn,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { accentCoral, peachAlpha, whiteAlpha, toastSurfaceSx } from "../../theme/tokens";
import { parseServerDate } from "../../utils/datetime";

type Snack = { message: string; severity: "success" | "error" } | null;
type RoleFilter = "all" | "admin" | "member";

/**
 * Admin user list. One row per non-deleted user with the role chip,
 * profile count and created-at timestamp. The "+ Invite user" CTA
 * opens an inline create dialog (email + initial password + role);
 * row click jumps to the detail page; the per-row trash icon hard-
 * removes after the standard danger confirm. The self row hides
 * the delete affordance — the server also enforces it.
 */
export function UsersAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.users.title"));

  const [filter, setFilter] = useState<RoleFilter>("all");
  const [pageSize, setPageSize] = useState(10);
  const role = filter === "all" ? undefined : filter;
  const { data, isLoading, isError, refetch } = useAdminUsers(role);
  const allRows = data ?? [];
  const paged = usePagedList<AdminUserSummary>(allRows, pageSize, role ?? "all");
  const { data: me } = useCurrentUser();
  const remove = useDeleteAdminUser();

  const [pendingDelete, setPendingDelete] = useState<AdminUserSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(pendingDelete.id);
      setSnack({
        message: t("admin.users.snack.deleteSuccess", { email: pendingDelete.email }),
        severity: "success",
      });
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : t("admin.users.snack.deleteFailed"),
      );
    }
  };

  const columns = useMemo<AdminTableColumn<AdminUserSummary>[]>(
    () => [
      {
        id: "email",
        label: t("admin.users.col.email"),
        render: (u) => (
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 0.75,
                bgcolor: peachAlpha(0.10),
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <UsersIcon size={15} aria-hidden />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500} noWrap>
                {u.email}
                {me?.id === u.id && (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      fontSize: "0.6875rem",
                      color: "text.secondary",
                      fontWeight: 400,
                    }}
                  >
                    {t("admin.users.youBadge")}
                  </Box>
                )}
              </Typography>
              <Typography variant="metaMono" color="text.secondary">
                {u.id}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        id: "role",
        label: t("admin.users.col.role"),
        width: "110px",
        render: (u) => (
          <AdminBadge tone={u.role === "admin" ? "peach" : "neutral"}>
            {t(`admin.users.role.${u.role}`)}
          </AdminBadge>
        ),
      },
      {
        id: "profiles",
        label: t("admin.users.col.profiles"),
        width: "100px",
        render: (u) => (
          <Typography variant="metaMono">{u.profile_count}</Typography>
        ),
      },
      {
        id: "created_at",
        label: t("admin.users.col.created"),
        width: "140px",
        muted: true,
        render: (u) => parseServerDate(u.created_at).toLocaleDateString(),
      },
      {
        id: "actions",
        label: "",
        width: "60px",
        align: "right",
        render: (u) =>
          me?.id === u.id ? null : (
            <Tooltip title={t("admin.users.action.delete")}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(u);
                  setDeleteError(null);
                }}
                sx={{ color: accentCoral }}
              >
                <Trash2 size={15} />
              </IconButton>
            </Tooltip>
          ),
      },
    ],
    [me?.id, t],
  );

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.identity"), t("admin.nav.users")]}
        title={t("admin.users.title")}
        subtitle={t("admin.users.subtitle")}
        primaryCTA={
          <AdminButton
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => setInviteOpen(true)}
          >
            {t("admin.users.inviteCta")}
          </AdminButton>
        }
        toolbar={
          <AdminToolbar>
            <FilterChip<RoleFilter>
              label={t("admin.users.filter.role")}
              value={filter}
              onChange={setFilter}
              options={[
                { label: t("admin.users.filter.all"), value: "all" },
                { label: t("admin.users.role.admin"), value: "admin" },
                { label: t("admin.users.role.member"), value: "member" },
              ]}
            />
          </AdminToolbar>
        }
      />

      <AdminTable
        columns={columns}
        rows={paged.items}
        rowKey="id"
        loading={isLoading}
        error={isError ? t("admin.users.errorLoading") : undefined}
        onRetry={() => void refetch()}
        onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
        emptyState={
          <FancyEmpty
            icon={UsersIcon}
            motif="orbit"
            title={t("admin.users.emptyTitle")}
            body={t("admin.users.emptyBody")}
            primary={
              <AdminButton
                variant="primary"
                icon={<Plus size={15} />}
                onClick={() => setInviteOpen(true)}
              >
                {t("admin.users.inviteCta")}
              </AdminButton>
            }
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

      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={(email) => {
          setInviteOpen(false);
          setSnack({
            message: t("admin.users.snack.inviteSuccess", { email }),
            severity: "success",
          });
        }}
      />

      <AdminConfirmDialog
        open={!!pendingDelete}
        title={t("admin.users.delete.title", { email: pendingDelete?.email ?? "" })}
        body={t("admin.users.delete.body")}
        consequences={[
          t("admin.users.delete.consequenceAccount"),
          t("admin.users.delete.consequenceProgress"),
          t("admin.users.delete.consequenceLists"),
        ]}
        danger
        busy={remove.isPending}
        errorMessage={deleteError}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={onConfirmDelete}
        confirmLabel={t("admin.users.delete.confirm")}
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
              ...toastSurfaceSx(snack.severity),
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

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

function InviteUserDialog({ open, onClose, onSuccess }: InviteUserDialogProps) {
  const { t } = useTranslation();
  const create = useCreateAdminUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setPassword("");
    setRole("member");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const summary = await create.mutateAsync({
        email: email.trim(),
        password,
        role,
      });
      reset();
      onSuccess(summary.email);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("admin.users.invite.error"),
      );
    }
  };

  return (
    <AdminDialog
      open={open}
      onClose={create.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={0.5} sx={{ mb: 2.5 }}>
          <Typography variant="h3" sx={{ fontSize: "1rem", fontWeight: 600 }}>
            {t("admin.users.invite.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("admin.users.invite.subtitle")}
          </Typography>
        </Stack>

        <Box component="form" onSubmit={submit}>
          <AdminFormSection
            title={t("admin.users.invite.section.account")}
            helper={t("admin.users.invite.section.accountHelper")}
          >
            <AdminInput
              label={t("admin.users.invite.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              fullWidth
            />
            <AdminInput
              label={t("admin.users.invite.password")}
              helperText={t("admin.users.invite.passwordHelper")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              inputProps={{ minLength: 8, maxLength: 128 }}
              fullWidth
            />
          </AdminFormSection>

          <AdminFormSection
            title={t("admin.users.invite.section.role")}
            helper={t("admin.users.invite.section.roleHelper")}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.875 }}>
              <Typography
                variant="eyebrow"
                component="label"
                sx={{
                  color: "text.secondary",
                  letterSpacing: "0.14em",
                  fontSize: "0.625rem",
                }}
              >
                {t("admin.users.invite.role")}
              </Typography>
              <Select<"admin" | "member">
                size="small"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
                sx={{
                  fontSize: "0.875rem",
                  bgcolor: whiteAlpha(0.025),
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: whiteAlpha(0.08),
                  },
                }}
              >
                <MenuItem value="member">{t("admin.users.role.member")}</MenuItem>
                <MenuItem value="admin">{t("admin.users.role.admin")}</MenuItem>
              </Select>
            </Box>
          </AdminFormSection>

          {error && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <AdminButton
              variant="ghost"
              type="button"
              onClick={() => {
                if (!create.isPending) {
                  reset();
                  onClose();
                }
              }}
              disabled={create.isPending}
            >
              {t("admin.users.invite.cancel")}
            </AdminButton>
            <AdminButton
              variant="primary"
              type="submit"
              disabled={create.isPending}
            >
              {create.isPending
                ? t("admin.users.invite.submitting")
                : t("admin.users.invite.submit")}
            </AdminButton>
          </Stack>
        </Box>
      </DialogContent>
    </AdminDialog>
  );
}
