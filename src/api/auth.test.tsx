import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authKeys, useSwitchProfile } from "./auth";
import { createQueryClient } from "./queryClient";

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }));

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  api: { get: vi.fn(), post: apiPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  apiPost.mockResolvedValue(undefined);
});

describe("useSwitchProfile", () => {
  it("drops profile-scoped queries and keeps the auth slice for refetch", async () => {
    const client = createQueryClient();
    client.setQueryData(authKeys.currentUser, { id: "usr_1", active_profile_id: "prf_a" });
    client.setQueryData(authKeys.profiles, []);
    client.setQueryData(["catalog", "recently-added", "en", 20], []);
    client.setQueryData(["watchlist", "en"], []);
    client.setQueryData(["libraries"], []);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSwitchProfile(), { wrapper });

    await result.current.mutateAsync("prf_b");

    expect(apiPost).toHaveBeenCalledWith("/profiles/prf_b/switch");
    const roots = client
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey[0]);
    expect(roots).toEqual(["auth", "auth"]);
    expect(client.getQueryState(authKeys.currentUser)?.isInvalidated).toBe(true);
    expect(client.getQueryState(authKeys.profiles)?.isInvalidated).toBe(true);
  });
});
