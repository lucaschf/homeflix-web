import { Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import { useCurrentUser } from "../../api/auth";

/**
 * Gate a route segment behind the admin role.
 *
 * - While ``useCurrentUser`` is resolving the cookie roundtrip,
 *   render a centred spinner so the layout doesn't flash empty.
 * - When the query resolves to ``null`` (anonymous), redirect to
 *   ``/login`` — the user must authenticate before we can decide
 *   anything about their role.
 * - When the user is authenticated but their ``role`` is not
 *   ``"admin"``, redirect to ``/`` (the catalog home). We do NOT
 *   bounce to ``/login`` because they are legitimately logged in;
 *   the admin segment is just not for them.
 *
 * Pairs with the backend's ``current_admin_user`` dependency: the
 * server is the source of truth (returns 403 to non-admins on
 * write-side endpoints), and this guard hides the matching UI so
 * regular members never see admin-only entry points to begin with.
 */
export function RequireAdmin() {
  const { data: currentUser, isLoading } = useCurrentUser();

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

  if (currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
