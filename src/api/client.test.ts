import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_EXPIRED_EVENT, ApiError, api, setParentalUnlockHandler } from "./client";
import { PARENTAL_GATE_HANDLED_BY_CALLER } from "./parentalGate";

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
  setParentalUnlockHandler(null);
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

/** A JSON success response with the backend envelope. */
function okResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client — parental gate on writes (ADR-035)", () => {
  const pinRequired = () => errorResponse(403, "PARENTAL_PIN_REQUIRED");

  /** Every ``fetch`` call's method and path, in order. */
  const sent = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit).method ?? "GET"} ${url}`);

  it("challenges a refused write and sends it once more after the unlock", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pinRequired())
      .mockResolvedValueOnce(okResponse({ id: "run_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const unlock = vi.fn().mockResolvedValue(undefined);
    setParentalUnlockHandler(unlock);

    const res = await api.post<{ data: { id: string } }>("/admin/scans", { library_id: "lib_1" });

    expect(res.data.id).toBe("run_1");
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(sent(fetchMock)).toEqual(["POST /api/v1/admin/scans", "POST /api/v1/admin/scans"]);
    // Same body both times, and the replay only after the unlock.
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ library_id: "lib_1" }));
    expect(unlock.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]);
  });

  it.each(["put", "patch", "del"] as const)("challenges a refused %s as well", async (method) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pinRequired())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    setParentalUnlockHandler(vi.fn().mockResolvedValue(undefined));

    await (method === "del" ? api.del("/admin/users/u_1") : api[method]("/admin/users/u_1", {}));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a replay refused again without a second challenge", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => pinRequired());
    vi.stubGlobal("fetch", fetchMock);
    const unlock = vi.fn().mockResolvedValue(undefined);
    setParentalUnlockHandler(unlock);

    const err = await api.post("/admin/scans", {}).catch((e: unknown) => e);

    expect((err as ApiError).body?.code).toBe("PARENTAL_PIN_REQUIRED");
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects with the original refusal, without replaying, when the challenge is closed", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => pinRequired());
    vi.stubGlobal("fetch", fetchMock);
    setParentalUnlockHandler(vi.fn().mockRejectedValue(new Error("cancelled")));

    const err = await api.post("/admin/scans", {}).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).body?.code).toBe("PARENTAL_PIN_REQUIRED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never challenges a read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => pinRequired()));
    const unlock = vi.fn().mockResolvedValue(undefined);
    setParentalUnlockHandler(unlock);

    await expect(api.get("/admin/jobs")).rejects.toBeInstanceOf(ApiError);
    expect(unlock).not.toHaveBeenCalled();
  });

  it("leaves a write whose caller handles the gate to that caller", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => pinRequired());
    vi.stubGlobal("fetch", fetchMock);
    const unlock = vi.fn().mockResolvedValue(undefined);
    setParentalUnlockHandler(unlock);

    await expect(
      api.post("/profiles/prf_1/switch", undefined, PARENTAL_GATE_HANDLED_BY_CALLER),
    ).rejects.toBeInstanceOf(ApiError);
    expect(unlock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves every other refusal alone", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => errorResponse(403, "ADMIN_REQUIRED"));
    vi.stubGlobal("fetch", fetchMock);
    const unlock = vi.fn().mockResolvedValue(undefined);
    setParentalUnlockHandler(unlock);

    await expect(api.post("/admin/scans", {})).rejects.toBeInstanceOf(ApiError);
    expect(unlock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes the refusal through while no handler is installed", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => pinRequired());
    vi.stubGlobal("fetch", fetchMock);

    const err = await api.post("/admin/scans", {}).catch((e: unknown) => e);

    expect((err as ApiError).body?.code).toBe("PARENTAL_PIN_REQUIRED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
