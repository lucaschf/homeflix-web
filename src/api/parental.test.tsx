import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authKeys } from "./auth";
import { ApiError } from "./client";
import { useRemoveParentalPin, useSetParentalPin, useUnlockParental } from "./parental";
import { createQueryClient } from "./queryClient";

const { apiPost, apiPut } = vi.hoisted(() => ({ apiPost: vi.fn(), apiPut: vi.fn() }));

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  api: { get: vi.fn(), post: apiPost, put: apiPut, patch: vi.fn(), del: vi.fn() },
}));

/** Every key the invalidation could touch, warm in the cache. */
const KEYS = [
  authKeys.currentUser,
  authKeys.profiles,
  ["libraries"],
  ["catalog", "recently-added", "en", 20],
] as const;

function setup() {
  const client = createQueryClient();
  for (const key of KEYS) client.setQueryData(key, { cached: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const invalidated = () =>
    KEYS.filter((key) => client.getQueryState(key)?.isInvalidated).map((key) => [...key]);
  return { client, wrapper, invalidated };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiPost.mockResolvedValue(undefined);
  apiPut.mockResolvedValue(undefined);
});

describe("parental hooks", () => {
  it("useSetParentalPin puts the password and PIN, then invalidates only the current user", async () => {
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useSetParentalPin(), { wrapper });

    await result.current.mutateAsync({ current_password: "pw", pin: "123456" });

    expect(apiPut).toHaveBeenCalledWith("/parental/pin", { current_password: "pw", pin: "123456" });
    expect(invalidated()).toEqual([[...authKeys.currentUser]]);
  });

  it("useRemoveParentalPin posts the password, then invalidates only the current user", async () => {
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useRemoveParentalPin(), { wrapper });

    await result.current.mutateAsync({ current_password: "pw" });

    expect(apiPost).toHaveBeenCalledWith("/parental/pin/remove", { current_password: "pw" });
    expect(invalidated()).toEqual([[...authKeys.currentUser]]);
  });

  it("useUnlockParental posts the PIN, then invalidates the current user and libraries", async () => {
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useUnlockParental(), { wrapper });

    await result.current.mutateAsync({ pin: "123456" });

    expect(apiPost).toHaveBeenCalledWith("/parental/unlock", { pin: "123456" });
    expect(invalidated()).toEqual([[...authKeys.currentUser], ["libraries"]]);
  });

  it("invalidates nothing when the call is refused", async () => {
    apiPost.mockRejectedValue(
      new ApiError(403, "", { code: "PARENTAL_PIN_INVALID", message: "", details: [] }),
    );
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useUnlockParental(), { wrapper });

    await expect(result.current.mutateAsync({ pin: "000000" })).rejects.toBeInstanceOf(ApiError);

    expect(invalidated()).toEqual([]);
  });
});
