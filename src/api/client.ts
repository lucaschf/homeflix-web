const BASE_URL = "/api/v1";

/**
 * Custom DOM event dispatched on the ``window`` whenever an API
 * call returns 401 unless the caller opts out (see ``expects401``).
 * The auth-expiration guard mounted in ``App.tsx`` listens to this
 * event and redirects the user to ``/login`` after clearing every
 * cached query — single source of truth for "your session went
 * away, sign in again."
 */
export const AUTH_EXPIRED_EVENT = "homeflix:auth-expired";

// Custom error so callers can branch on the HTTP status (e.g. 401 →
// "not logged in", 400 → "bad credentials") without re-parsing the
// generic Error message string. Kept tiny on purpose — full body
// parsing for structured backend errors lands when the route layer
// actually needs it.
export class ApiError extends Error {
  // ``erasableSyntaxOnly`` (tsconfig) bans parameter properties, so
  // the fields are declared up front and assigned in the body.
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
  }
}

interface RequestOptions extends RequestInit {
  /**
   * Suppresses the ``AUTH_EXPIRED_EVENT`` dispatch on a 401
   * response. Set on the call sites that legitimately handle 401
   * as a non-error state — e.g. ``GET /users/me`` returning the
   * anonymous-visitor signal, the cookie-login mutation surfacing
   * "bad credentials", ``GET /profiles`` resolving to ``[]`` for
   * unauthenticated callers. Without this, a stale-session-mid-
   * request would still fire the global handler from those
   * endpoints and bounce the user to /login from a screen they
   * are already rendering anonymously.
   */
  expects401?: boolean;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { expects401, ...fetchOptions } = options ?? {};
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...fetchOptions.headers },
    // Send and accept the ``homeflix_session`` cookie on every
    // request. Required for any endpoint that reads ``current_user``
    // or ``profile_id`` from the session (auth, profiles, and —
    // once strict mode lands — the entire catalog).
    credentials: "include",
    ...fetchOptions,
  });

  if (!response.ok) {
    if (response.status === 401 && !expects401 && typeof window !== "undefined") {
      // Fire-and-forget global signal. The catch-and-redirect lives
      // in ``AuthExpirationGuard`` so this module stays free of
      // router/query-cache deps.
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(response.status, response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

function withParams(path: string, params?: Record<string, string>): string {
  if (!params) return path;
  const search = new URLSearchParams(params).toString();
  return search ? `${path}?${search}` : path;
}

interface ApiOptions {
  /** See ``RequestOptions.expects401``. */
  expects401?: boolean;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>, options?: ApiOptions) =>
    request<T>(withParams(path, params), options),
  post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  put: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  del: (path: string, options?: ApiOptions) =>
    request<void>(path, { method: "DELETE", ...options }),
  // FastAPI Users' cookie-login endpoint takes
  // ``application/x-www-form-urlencoded`` (OAuth2-password-flow
  // shape: ``username`` + ``password``). Carving this out as its
  // own helper keeps the JSON-default ``post`` clean and lets the
  // login mutation read like ``api.postForm("/auth/...", { ... })``.
  postForm: <T>(path: string, fields: Record<string, string>, options?: ApiOptions) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
      ...options,
    }),
};
