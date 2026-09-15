import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_EXPIRED_EVENT, ApiError, api } from "./client";

/** A JSON error response with the backend envelope. */
function errorResponse(status: number, code: string) {
  return new Response(JSON.stringify({ message: code, code, type: "error", details: [] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const onExpired = vi.fn();

beforeEach(() => {
  window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
});

afterEach(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  vi.unstubAllGlobals();
  onExpired.mockClear();
});

describe("api client — auth-expired signal", () => {
  it("does not treat a parental-gate 403 as an expired session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(403, "PARENTAL_PIN_REQUIRED")));

    const err = await api.post("/profiles/prf_1/switch").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).body?.code).toBe("PARENTAL_PIN_REQUIRED");
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("does not treat a restricted title as an expired session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse(403, "CONTENT_RESTRICTED_BY_MATURITY")),
    );

    await expect(api.get("/movies/mov_1")).rejects.toBeInstanceOf(ApiError);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("fires the signal on a 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(401, "UNAUTHORIZED")));

    await expect(api.get("/movies/mov_1")).rejects.toBeInstanceOf(ApiError);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on a 401 the caller expects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(401, "UNAUTHORIZED")));

    await expect(
      api.get("/users/me", undefined, { expects401: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onExpired).not.toHaveBeenCalled();
  });
});
