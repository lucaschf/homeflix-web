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

/**
 * Shape of the standard error envelope returned by the backend per
 * ``docs/standards/api-response-standard-rest-v3.md`` — ``message``
 * is the human-readable text, ``code`` and ``type`` are stable IDs
 * suitable for switch logic on the caller. All fields optional so
 * non-conforming error responses (proxy HTML, network failures
 * decoded as plain text) still type-check.
 */
export interface ApiErrorBody {
  message?: string;
  code?: string;
  type?: string;
  details?: unknown;
}

// Custom error so callers can branch on the HTTP status (e.g. 401 →
// "not logged in", 400 → "bad credentials") without re-parsing the
// generic Error message string. ``body`` carries the parsed backend
// envelope so toasts / inline alerts can render the operator-facing
// message directly via ``err.message`` instead of the generic
// "API Error: 422 ..." fallback.
export class ApiError extends Error {
  // ``erasableSyntaxOnly`` (tsconfig) bans parameter properties, so
  // the fields are declared up front and assigned in the body.
  readonly status: number;
  readonly statusText: string;
  readonly body: ApiErrorBody | null;

  constructor(status: number, statusText: string, body: ApiErrorBody | null = null) {
    // Backend-provided message wins when present so callers that
    // only display ``err.message`` get the operator-facing text by
    // default. Falls back to the generic shape for non-JSON errors.
    super(body?.message ?? `API Error: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
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
  // Skip the JSON ``Content-Type`` default when the body is
  // ``FormData`` — multipart uploads need the browser to set the
  // header itself so the boundary token gets injected. Hand-setting
  // ``application/json`` would clobber it and the server would 422.
  const isFormData =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : { "Content-Type": "application/json" };
  const response = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers: { ...baseHeaders, ...(fetchOptions.headers ?? {}) },
    // Send and accept the ``homeflix_session`` cookie on every
    // request. Required for any endpoint that reads ``current_user``
    // or ``profile_id`` from the session (auth, profiles, and —
    // once strict mode lands — the entire catalog).
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401 && !expects401 && typeof window !== "undefined") {
      // Fire-and-forget global signal. The catch-and-redirect lives
      // in ``AuthExpirationGuard`` so this module stays free of
      // router/query-cache deps.
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    // Best-effort parse of the structured error envelope. The body
    // is consumed once — proxies / connection drops that ship a
    // non-JSON payload land in the catch and the error still throws
    // with the generic message + status pair as before.
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(response.status, response.statusText, body);
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
  // ``T`` defaults to ``void`` so the typical "DELETE → 204" call
  // site reads as before. Endpoints that respond with a body
  // (e.g. ``DELETE /profiles/{id}/avatar`` returns the updated
  // ``Profile``) parameterise it explicitly: ``api.del<ProfileResponse>(...)``.
  del: <T = void>(path: string, options?: ApiOptions) =>
    request<T>(path, { method: "DELETE", ...options }),
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
  // ``multipart/form-data`` for file uploads (e.g. profile avatar).
  // ``request()`` detects the ``FormData`` body and skips the JSON
  // ``Content-Type`` default so the browser can inject the boundary
  // token — the only way the server parses the multipart body.
  postMultipart: <T>(path: string, formData: FormData, options?: ApiOptions) =>
    request<T>(path, {
      method: "POST",
      body: formData,
      ...options,
    }),
};
