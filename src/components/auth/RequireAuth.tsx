import { Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../../api/auth";

/**
 * Gate every route segment that requires a logged-in user.
 *
 * - While ``useCurrentUser`` is resolving the cookie roundtrip,
 *   render a centered spinner so the layout doesn't flash empty
 *   between the splash dismissing and the first page rendering.
 * - When the query resolves to ``null`` (anonymous), redirect to
 *   ``/login`` and stash the originally-requested URL in
 *   ``location.state`` so the login flow can hand the user back
 *   where they came from after authenticating (a future PR can
 *   read this; today's Login always navigates to ``/profiles``
 *   regardless).
 * - Otherwise the segment renders normally via ``<Outlet />``.
 *
 * The guard intentionally does NOT verify that a profile is
 * selected — backend ``resolve_profile_id`` falls back to the
 * configured ``MEDIA_DEFAULT_PROFILE_ID`` during the rollout, so
 * a logged-in user without an active profile still sees a usable
 * catalog. Once strict mode lands and the catalog APIs return 401
 * for missing profiles, a global 401 handler will pick that up
 * separately.
 */
export function RequireAuth() {
  const location = useLocation();
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
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
