import { useCurrentUser } from "../api/auth";
import type { AdminAccess } from "../api/types";

/**
 * Admin authority of the current session, read from ``/users/me``.
 *
 * Gate admin UI on this rather than on ``role``: the parental gate
 * (ADR-035) suspends an administrator's authority while the session is
 * under an age-limited profile, and the backend then answers admin
 * routes with 403 ``PARENTAL_PIN_REQUIRED`` even though ``role`` is still
 * ``"admin"``.
 *
 * - ``"granted"``: render admin entry points and routes.
 * - ``"suspended"``: an admin whose authority is locked; hide the entry
 *   points and show the lock screen instead of the admin routes.
 * - ``"none"``: not an admin, or no user (anonymous or still loading).
 *
 * A backend that predates ``admin_access`` is read by ``role``, which is
 * what the field reports for an account without a parental PIN.
 */
export function useAdminCapability(): AdminAccess {
  const { data: currentUser } = useCurrentUser();
  if (!currentUser) return "none";
  return currentUser.admin_access ?? (currentUser.role === "admin" ? "granted" : "none");
}
