import { Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import { useCurrentUser } from "../../api/auth";
import { useAdminCapability } from "../../hooks/useAdminCapability";
import { AdminLockedScreen } from "./AdminLockedScreen";

/**
 * Gate a route segment behind the session's admin authority.
 *
 * - While ``useCurrentUser`` is resolving the cookie roundtrip,
 *   render a centred spinner so the layout doesn't flash empty.
 * - When the query resolves to ``null`` (anonymous), redirect to
 *   ``/login`` — the user must authenticate before we can decide
 *   anything about their role.
 * - When ``useAdminCapability`` reports ``"suspended"`` (an admin
 *   under an age-limited profile, ADR-035), render the lock screen
 *   INSTEAD of the outlet: the admin shell is not mounted, so none of
 *   its queries fire.
 * - When it reports ``"none"``, redirect to ``/`` (the catalog home).
 *   We do NOT bounce to ``/login`` because they are legitimately
 *   logged in; the admin segment is just not for them.
 *
 * Pairs with the backend's ``current_admin_user`` dependency: the
 * server is the source of truth (returns 403 to non-admins and to
 * suspended admins), and this guard hides the matching UI so
 * regular members never see admin-only entry points to begin with.
 */
export function RequireAdmin() {
  const { data: currentUser, isLoading } = useCurrentUser();
  const adminAccess = useAdminCapability();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (adminAccess === "suspended") {
    return <AdminLockedScreen />;
  }

  if (adminAccess !== "granted") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
