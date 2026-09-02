import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackPreferencesData } from "../api/types";
import { usePlaybackPreferences } from "./usePlaybackPreferences";

const { apiGet, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("../api/client", () => ({
  AUTH_EXPIRED_EVENT: "homeflix:auth-expired",
  ApiError: class ApiError extends Error {},
  api: {
    get: apiGet,
    post: vi.fn(),
    put: apiPut,
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const SERVER_PREFS: PlaybackPreferencesData = {
  audio_lang: "pt-BR",
  subtitle_lang: "pt-BR",
  subtitle_mode: "foreignOnly",
  default_quality: "best",
  speed: 1,
  subtitle_appearance: {
    color: "#FFFFFF",
    background: "rgba(0, 0, 0, 0.75)",
    font_size: "medium",
    text_edge: "shadow",
  },
  intro_skip_mode: "manual",
  credits_skip_mode: "manual",
};

/**
 * Point the mocked client at one profile's data. ``preferences: null``
 * leaves that query hanging, which is what the first render after a
 * profile switch looks like — the cache is all the hook has to go on.
 */
function stubProfile(
  profileId: string,
  preferences: Partial<PlaybackPreferencesData> | null,
) {
  apiGet.mockImplementation((path: string) => {
    if (path === "/users/me") {
      return Promise.resolve({ data: { id: "usr_1", active_profile_id: profileId } });
    }
    if (path === "/preferences") {
      if (!preferences) return new Promise(() => {});
      return Promise.resolve({ data: { ...SERVER_PREFS, ...preferences } });
    }
    return Promise.resolve({ data: null });
  });
}

/** Each call stands for a fresh query cache — what a profile switch leaves behind. */
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePlaybackPreferences — skip modes", () => {
  it("reads both modes off the API response", async () => {
    stubProfile("prf_a", { intro_skip_mode: "autoAfterFirst", credits_skip_mode: "auto" });
    const { result } = renderHook(() => usePlaybackPreferences(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current[0].introSkipMode).toBe("autoAfterFirst"));
    expect(result.current[0].creditsSkipMode).toBe("auto");
  });

  it("defaults to manual when the backend omits the fields", async () => {
    stubProfile("prf_a", { intro_skip_mode: undefined, credits_skip_mode: undefined });
    const { result } = renderHook(() => usePlaybackPreferences(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/preferences"));
    expect(result.current[0].introSkipMode).toBe("manual");
    expect(result.current[0].creditsSkipMode).toBe("manual");
  });

  it("ignores a mode outside the API enum", async () => {
    stubProfile("prf_a", { intro_skip_mode: "afterTheThirdOne" });
    const { result } = renderHook(() => usePlaybackPreferences(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/preferences"));
    expect(result.current[0].introSkipMode).toBe("manual");
  });

  it("does not hand one profile's modes to the next", async () => {
    stubProfile("prf_a", { intro_skip_mode: "auto", credits_skip_mode: "auto" });
    const first = renderHook(() => usePlaybackPreferences(), { wrapper: wrapper() });
    await waitFor(() => expect(first.result.current[0].introSkipMode).toBe("auto"));
    first.unmount();

    // Switching profiles clears the query cache, so for a render or two
    // the localStorage copy is all there is. It must not be prf_a's.
    stubProfile("prf_b", null);
    const second = renderHook(() => usePlaybackPreferences(), { wrapper: wrapper() });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/users/me", undefined, {
      expects401: true,
    }));
    expect(second.result.current[0].introSkipMode).toBe("manual");
    expect(second.result.current[0].creditsSkipMode).toBe("manual");

    // ...while the profile that owns the cache still gets it back.
    stubProfile("prf_a", null);
    const back = renderHook(() => usePlaybackPreferences(), { wrapper: wrapper() });
    await waitFor(() => expect(back.result.current[0].introSkipMode).toBe("auto"));
  });

  it("sends only the field that changed", async () => {
    stubProfile("prf_a", {});
    apiPut.mockResolvedValue({ data: { ...SERVER_PREFS, credits_skip_mode: "auto" } });
    const { result } = renderHook(() => usePlaybackPreferences(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/preferences"));

    result.current[1]({ creditsSkipMode: "auto" });

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/preferences", { credits_skip_mode: "auto" }),
    );
  });
});
