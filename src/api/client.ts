const BASE_URL = "/api/v1";

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    // Send and accept the ``homeflix_session`` cookie on every
    // request. Required for any endpoint that reads ``current_user``
    // or ``profile_id`` from the session (auth, profiles, and —
    // once strict mode lands — the entire catalog).
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
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

export const api = {
  get: <T>(path: string, params?: Record<string, string>) => request<T>(withParams(path, params)),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
  // FastAPI Users' cookie-login endpoint takes
  // ``application/x-www-form-urlencoded`` (OAuth2-password-flow
  // shape: ``username`` + ``password``). Carving this out as its
  // own helper keeps the JSON-default ``post`` clean and lets the
  // login mutation read like ``api.postForm("/auth/...", { ... })``.
  postForm: <T>(path: string, fields: Record<string, string>) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    }),
};
