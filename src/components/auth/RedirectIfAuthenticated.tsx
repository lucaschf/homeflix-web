import { Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import { useCurrentUser } from "../../api/auth";

/**
 * Inverse of ``RequireAuth``: wraps the routes that should NOT be
 * reachable while logged in (today only ``/login``). An already-
 * authenticated visitor lands on the profile picker instead of
 * the form they don't need.
 *
 * Same loading shimmer as ``RequireAuth`` so the perceived
 * behaviour stays symmetric across the two guards.
 */
export function RedirectIfAuthenticated() {
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

  if (currentUser) return <Navigate to="/profiles" replace />;

  return <Outlet />;
}
