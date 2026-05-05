import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { AUTH_EXPIRED_EVENT } from "../../api/client";

/**
 * Listens for the global ``AUTH_EXPIRED_EVENT`` dispatched by
 * ``api/client.ts`` when an unhandled 401 lands on a request. On
 * fire it clears every cached query and bounces the user to
 * ``/login``.
 *
 * Decoupling the redirect from the request layer keeps
 * ``client.ts`` free of routing / TanStack-Query dependencies and
 * lets this single guard handle every catalog endpoint at once.
 *
 * Mounted inside ``<BrowserRouter>`` and ``<QueryClientProvider>``
 * but outside ``<Routes>`` so it's always alive across navigation.
 *
 * Idempotency: once the navigation lands on ``/login`` the guard
 * skips the redirect to avoid loops if a stale request still
 * resolves with 401 after the cookie was cleared.
 */
export function AuthExpirationGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      // Already on /login — likely a stale in-flight 401 racing
      // with the user landing there. No-op rather than navigate
      // back to itself (which would scroll-reset / re-mount).
      if (location.pathname === "/login") return;
      queryClient.clear();
      navigate("/login", { replace: true });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [navigate, location.pathname, queryClient]);

  return null;
}
