const BASE_URL = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
};
