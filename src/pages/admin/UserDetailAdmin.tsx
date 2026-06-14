import {
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ArrowLeft,
  Baby,
  Mail,
  Shield,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useCurrentUser } from "../../api/auth";
import {
  useAdminUser,
  useDeleteAdminUser,
  useUpdateUserRole,
} from "../../api/hooks";
import type { AdminProfileSummary } from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminConfirmDialog,
  AdminFormSection,
  AdminPageHeader,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { status, whiteAlpha } from "../../theme/tokens";

type Snack = { message: string; severity: "success" | "error" } | null;
type Role = "admin" | "member";

/**
 * Admin user detail page. Two columns on wide viewports:
 *
 * - Account card on the left: email, role select, delete CTA. Role
 *   flip and delete refuse self-targeting on the client (the
 *   affordances are hidden) and on the server.
 * - Profiles card on the right: read-only list of every profile
 *   the user owns plus their ACL grants. Members still manage
 *   their own profiles via /settings; admin-side profile CRUD is
 *   deferred to a follow-up.
 */
export function UserDetailAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: userId } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useAdminUser(userId);
  const { data: me } = useCurrentUser();
  const updateRole = useUpdateUserRole();
  const remove = useDeleteAdminUser();

  useDocumentTitle(
    data ? t("admin.users.detail.title", { email: data.email }) : t("admin.nav.users"),
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  const isSelf = !!data && me?.id === data.id;

  const onRoleChange = async (next: Role) => {
    if (!data || data.role === next) return;
    setRoleError(null);
    try {
      await updateRole.mutateAsync({ userId: data.id, role: next });
      setSnack({
        message: t("admin.users.snack.roleUpdated", {
          email: data.email,
          role: t(`admin.users.role.${next}`),
        }),
        severity: "success",
      });
    } catch (err) {
      setRoleError(
        err instanceof ApiError ? err.message : t("admin.users.snack.roleFailed"),
      );
    }
  };

  const onConfirmDelete = async () => {
    if (!data) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(data.id);
      navigate("/admin/users");
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : t("admin.users.snack.deleteFailed"),
      );
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={24} color="primary" />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <AdminCard>
        <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
          <Typography variant="body2" color="error">
            {t("admin.users.errorLoading")}
          </Typography>
          <AdminButton variant="secondary" onClick={() => void refetch()}>
            {t("admin.table.retry")}
          </AdminButton>
        </Stack>
      </AdminCard>
    );
  }

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.identity"), t("admin.nav.users"), data.email]}
        title={data.email}
        subtitle={t("admin.users.detail.subtitle")}
        primaryCTA={
          <AdminButton
            variant="ghost"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate("/admin/users")}
          >
            {t("admin.users.detail.backCta")}
          </AdminButton>
        }
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <AdminCard>
          <AdminCardHeader
            icon={UserIcon}
            title={t("admin.users.detail.account.title")}
            subtitle={t("admin.users.detail.account.subtitle")}
          />

          <AdminFormSection
            title={t("admin.users.detail.account.emailLabel")}
            helper={t("admin.users.detail.account.emailHelper")}
          >
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box sx={{ color: "text.secondary", display: "flex" }}>
                <Mail size={14} aria-hidden />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {data.email}
              </Typography>
            </Stack>
            <Typography
              variant="metaMono"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              {data.id}
            </Typography>
          </AdminFormSection>

          <AdminFormSection
            title={t("admin.users.detail.account.roleLabel")}
            helper={
              isSelf
                ? t("admin.users.detail.account.roleHelperSelf")
                : t("admin.users.detail.account.roleHelper")
            }
          >
            <Stack spacing={1}>
              <Select<Role>
                size="small"
                value={data.role}
                onChange={(e) => void onRoleChange(e.target.value as Role)}
                disabled={isSelf || updateRole.isPending}
                sx={{
                  fontSize: "0.875rem",
                  bgcolor: whiteAlpha(0.025),
                  maxWidth: 220,
                }}
              >
                <MenuItem value="member">{t("admin.users.role.member")}</MenuItem>
                <MenuItem value="admin">{t("admin.users.role.admin")}</MenuItem>
              </Select>
              {roleError && (
                <Typography variant="body2" color="error">
                  {roleError}
                </Typography>
              )}
            </Stack>
          </AdminFormSection>

          {!isSelf && (
            <AdminFormSection
              title={t("admin.users.detail.account.dangerTitle")}
              helper={t("admin.users.detail.account.dangerHelper")}
            >
              <AdminButton
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={() => {
                  setDeleteOpen(true);
                  setDeleteError(null);
                }}
              >
                {t("admin.users.detail.account.deleteCta")}
              </AdminButton>
            </AdminFormSection>
          )}
        </AdminCard>

        <AdminCard>
          <AdminCardHeader
            icon={UsersIcon}
            title={t("admin.users.detail.profiles.title", {
              count: data.profiles.length,
            })}
            subtitle={t("admin.users.detail.profiles.subtitle")}
          />

          {data.profiles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t("admin.users.detail.profiles.empty")}
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {data.profiles.map((p) => (
                <ProfileRow key={p.id} profile={p} />
              ))}
            </Stack>
          )}
        </AdminCard>
      </Box>

      <AdminConfirmDialog
        open={deleteOpen}
        title={t("admin.users.delete.title", { email: data.email })}
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
          setDeleteOpen(false);
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

function ProfileRow({ profile }: { profile: AdminProfileSummary }) {
  const { t } = useTranslation();
  const aclCount = profile.allowed_library_ids.length;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.25,
        px: 1.5,
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
        bgcolor: whiteAlpha(0.015),
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          bgcolor: whiteAlpha(0.04),
          color: "text.secondary",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {profile.avatar_url ? (
          <Box
            component="img"
            src={profile.avatar_url}
            alt=""
            sx={{ width: 32, height: 32, objectFit: "cover" }}
          />
        ) : profile.is_kids ? (
          <Baby size={16} aria-hidden />
        ) : (
          <UserIcon size={16} aria-hidden />
        )}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {profile.name}
          </Typography>
          {profile.is_kids && (
            <AdminBadge tone="info">{t("admin.users.detail.profiles.kidsBadge")}</AdminBadge>
          )}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 0.25 }}>
          <Box sx={{ color: "text.secondary", display: "flex" }}>
            <Shield size={11} aria-hidden />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {aclCount === 0
              ? t("admin.users.detail.profiles.aclAll")
              : t("admin.users.detail.profiles.aclScoped", { count: aclCount })}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
