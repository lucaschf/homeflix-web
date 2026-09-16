import {
  Alert,
  Box,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Plus, Trash2, Users as UsersIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
import {
  accentCoral,
  fontFamily,
  fontSize,
  peachAlpha,
  whiteAlpha,
  toastSurfaceSx,
} from "../../theme/tokens";
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

type InviteRole = "admin" | "member";

const INVITE_ROLES: InviteRole[] = ["member", "admin"];

/**
 * Create-user modal: email + initial password + role, stacked in a
 * single column.
 *
 * It deliberately does NOT use ``AdminFormSection``. That primitive is
 * a page-level row (a 340-460 px label column beside the field column)
 * and its breakpoints read the *viewport*, not the dialog — inside a
 * ``maxWidth="sm"`` paper on a desktop viewport the label column ate
 * the whole width, squeezing the inputs into ~90 px stubs and pushing
 * the paper into horizontal scroll. Full-width fields with the label
 * above are the right shape for a modal; the section helper copy moved
 * onto the fields it describes.
 */
function InviteUserDialog({ open, onClose, onSuccess }: InviteUserDialogProps) {
  const { t } = useTranslation();
  const create = useCreateAdminUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<InviteRole>("member");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole("member");
    setError(null);
  };

  const close = () => {
    if (create.isPending) return;
    reset();
    onClose();
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
      onClose={create.isPending ? undefined : close}
      maxWidth="sm"
      fullWidth
    >
      <Box component="form" onSubmit={submit}>
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 2,
            px: 3,
            pt: 3,
            pb: 0,
          }}
        >
          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" sx={{ fontSize: "1.0625rem" }}>
              {t("admin.users.invite.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <Trans
                i18nKey="admin.users.invite.subtitle"
                components={{
                  path: (
                    <Box
                      component="span"
                      sx={{ color: "primary.main", fontFamily: fontFamily.mono }}
                    />
                  ),
                }}
              />
            </Typography>
          </Stack>
          <IconButton
            size="small"
            onClick={close}
            disabled={create.isPending}
            aria-label={t("admin.users.invite.close")}
            sx={{ color: "text.secondary", mt: -0.5, mr: -0.5 }}
          >
            <X size={16} />
          </IconButton>
        </DialogTitle>

        {/* MUI zeroes the content's top padding when it follows a
            ``DialogTitle``; the class-on-class selector wins that back so
            the first field isn't glued to the subtitle. */}
        <DialogContent
          sx={{ px: 3, pb: 1, "&.MuiDialogContent-root": { pt: 3 } }}
        >
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            <AdminInput
              label={t("admin.users.invite.email")}
              type="email"
              placeholder={t("admin.users.invite.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              fullWidth
            />

            <Box>
              <AdminInput
                label={t("admin.users.invite.password")}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                inputProps={{ minLength: 8, maxLength: 128 }}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-pressed={showPassword}
                        aria-label={t(
                          showPassword
                            ? "admin.users.invite.hidePasswordAria"
                            : "admin.users.invite.showPasswordAria",
                        )}
                        sx={{
                          border: 0,
                          bgcolor: "transparent",
                          cursor: "pointer",
                          p: 0,
                          fontFamily: fontFamily.mono,
                          fontSize: fontSize.badge,
                          letterSpacing: "0.08em",
                          color: "text.secondary",
                          "&:hover": { color: "text.primary" },
                        }}
                      >
                        {t(
                          showPassword
                            ? "admin.users.invite.hidePassword"
                            : "admin.users.invite.showPassword",
                        )}
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />
              <Box
                sx={{
                  mt: 0.875,
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  columnGap: 1,
                }}
              >
                {/* The dot cell is exactly one ``body2`` line box tall
                    (0.75rem × 1.5) so the bullet stays centered on the
                    FIRST line when the helper wraps. */}
                <Box
                  aria-hidden
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "1.125rem",
                  }}
                >
                  <Box
                    sx={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      bgcolor: whiteAlpha(0.28),
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t("admin.users.invite.passwordHelper")}
                </Typography>
              </Box>
            </Box>

            <Box>
              <Stack
                direction="row"
                alignItems="baseline"
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1.25 }}
              >
                <Typography variant="body1" fontWeight={600} id="invite-role-label">
                  {t("admin.users.invite.role.label")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("admin.users.invite.role.hint")}
                </Typography>
              </Stack>
              <RadioGroup
                aria-labelledby="invite-role-label"
                value={role}
                onChange={(_e, next) => setRole(next as InviteRole)}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1.25,
                }}
              >
                {INVITE_ROLES.map((option) => {
                  const selected = role === option;
                  return (
                    <Box
                      key={option}
                      component="label"
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.25,
                        px: 1.75,
                        py: 1.5,
                        cursor: "pointer",
                        borderRadius: 1,
                        border: `1px solid ${
                          selected ? peachAlpha(0.55) : whiteAlpha(0.08)
                        }`,
                        bgcolor: selected ? peachAlpha(0.07) : whiteAlpha(0.025),
                        transition: "border-color 150ms ease, background-color 150ms ease",
                        "&:hover": {
                          borderColor: selected ? peachAlpha(0.7) : whiteAlpha(0.16),
                        },
                      }}
                    >
                      <Radio
                        value={option}
                        size="small"
                        disableRipple
                        sx={{
                          p: 0,
                          mt: "1px",
                          color: whiteAlpha(0.28),
                          "&.Mui-checked": { color: "primary.main" },
                        }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={600}>
                          {t(`admin.users.role.${option}`)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.25 }}
                        >
                          <Trans
                            i18nKey={`admin.users.invite.role.${option}Helper`}
                            components={{
                              path: (
                                <Box
                                  component="span"
                                  sx={{ fontFamily: fontFamily.mono }}
                                />
                              ),
                            }}
                          />
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </RadioGroup>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pt: 2,
            pb: 2.5,
            mt: 1,
            gap: 1.25,
            borderTop: `1px solid ${whiteAlpha(0.06)}`,
          }}
        >
          <AdminButton
            variant="secondary"
            type="button"
            onClick={close}
            disabled={create.isPending}
          >
            {t("admin.users.invite.cancel")}
          </AdminButton>
          <AdminButton
            variant="primary"
            type="submit"
            disabled={create.isPending}
            icon={
              create.isPending ? (
                <CircularProgress size={14} color="inherit" />
              ) : undefined
            }
          >
            {create.isPending
              ? t("admin.users.invite.submitting")
              : t("admin.users.invite.submit")}
          </AdminButton>
        </DialogActions>
      </Box>
    </AdminDialog>
  );
}
