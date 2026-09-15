import type { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authKeys } from "./auth";
import { ApiError } from "./client";
import { PARENTAL_GATE_HANDLED_BY_CALLER, PARENTAL_PIN_REQUIRED_EVENT } from "./parentalGate";
import { createQueryClient, shouldRetry } from "./queryClient";

const apiError = (status: number) => new ApiError(status, "", null);

describe("shouldRetry", () => {
  it.each([401, 403, 404])("never retries a %i", (status) => {
    expect(shouldRetry(0, apiError(status))).toBe(false);
  });

  it("retries a 500 up to three times", () => {
    expect(shouldRetry(0, apiError(500))).toBe(true);
    expect(shouldRetry(2, apiError(500))).toBe(true);
    expect(shouldRetry(3, apiError(500))).toBe(false);
  });

  it("retries a network failure like the library default", () => {
    const offline = new TypeError("Failed to fetch");
    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(3, offline)).toBe(false);
  });

  it("is the default for every query of the app client", () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(shouldRetry);
  });
});

describe("query error handling", () => {
  const gateError = (code: string) =>
    new ApiError(403, "Forbidden", { code, message: "", type: "forbidden", details: [] });

  /** Data a session leaves in the cache besides the current user. */
  const OTHER_KEYS = [
    authKeys.profiles,
    ["catalog", "recently-added", "en", 20],
    ["admin", "series", "needs-review"],
  ];

  /** An app client over a warm cache, with ``invalidateQueries`` observed. */
  function warmClient() {
    const client = createQueryClient();
    client.setQueryData(authKeys.currentUser, { id: "usr_1", role: "admin" });
    for (const key of OTHER_KEYS) client.setQueryData(key, []);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    return { client, invalidate };
  }

  /** Fails a query through the cache, as a mounted ``useQuery`` would. */
  async function failQuery(client: QueryClient, key: readonly string[], error: Error) {
    await expect(
      client.fetchQuery({ queryKey: key, queryFn: () => Promise.reject(error) }),
    ).rejects.toBe(error);
  }

  const isInvalidated = (client: QueryClient, key: readonly unknown[]) =>
    client.getQueryState(key)?.isInvalidated;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refetches only the current user on PARENTAL_PIN_REQUIRED, and opens nothing", async () => {
    const { client, invalidate } = warmClient();
    const dispatch = vi.spyOn(window, "dispatchEvent");

    await failQuery(client, ["admin", "movies", "needs-review"], gateError("PARENTAL_PIN_REQUIRED"));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate.mock.calls[0][0]).toEqual({ queryKey: authKeys.currentUser, exact: true });
    expect(isInvalidated(client, authKeys.currentUser)).toBe(true);
    for (const key of OTHER_KEYS) expect(isInvalidated(client, key)).toBe(false);
    // No global signal (the way a non-React module opens UI) and no dialog.
    expect(dispatch).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("leaves the cache alone on any other 403", async () => {
    const { client, invalidate } = warmClient();

    await failQuery(client, ["movie", "mov_1", "en"], gateError("CONTENT_RESTRICTED_BY_MATURITY"));

    expect(invalidate).not.toHaveBeenCalled();
    expect(isInvalidated(client, authKeys.currentUser)).toBe(false);
  });

  it("does not refetch the current user in a loop when that query itself is gated", async () => {
    const { client, invalidate } = warmClient();

    await failQuery(client, authKeys.currentUser, gateError("PARENTAL_PIN_REQUIRED"));

    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("mutation error handling", () => {
  const gateError = (code: string) =>
    new ApiError(403, "Forbidden", { code, message: "", type: "forbidden", details: [] });

  /** Runs one mutation through the cache, as ``useMutation`` would. */
  async function failMutation(client: QueryClient, error: Error, meta?: Record<string, unknown>) {
    const mutationFn = vi.fn().mockRejectedValue(error);
    const mutation = client.getMutationCache().build(client, { mutationFn, meta });
    await expect(mutation.execute(undefined)).rejects.toBe(error);
    return mutationFn;
  }

  /** Counts ``PARENTAL_PIN_REQUIRED_EVENT`` dispatches. */
  function listen() {
    const listener = vi.fn();
    window.addEventListener(PARENTAL_PIN_REQUIRED_EVENT, listener);
    return {
      listener,
      stop: () => window.removeEventListener(PARENTAL_PIN_REQUIRED_EVENT, listener),
    };
  }

  it("asks for the challenge once on PARENTAL_PIN_REQUIRED and never re-sends the mutation", async () => {
    const client = createQueryClient();
    const { listener, stop } = listen();

    const mutationFn = await failMutation(client, gateError("PARENTAL_PIN_REQUIRED"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("stays out of a mutation whose caller handles the parental gate", async () => {
    const client = createQueryClient();
    const { listener, stop } = listen();

    await failMutation(client, gateError("PARENTAL_PIN_REQUIRED"), PARENTAL_GATE_HANDLED_BY_CALLER);
    stop();

    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores every other mutation error", async () => {
    const client = createQueryClient();
    const { listener, stop } = listen();

    await failMutation(client, gateError("ADMIN_REQUIRED"));
    await failMutation(client, new ApiError(500, "Server Error", null));
    stop();

    expect(listener).not.toHaveBeenCalled();
  });

  it("asks for no challenge when a query is refused with PARENTAL_PIN_REQUIRED", async () => {
    const client = createQueryClient();
    const { listener, stop } = listen();
    const error = gateError("PARENTAL_PIN_REQUIRED");

    await expect(
      client.fetchQuery({ queryKey: ["admin", "jobs"], queryFn: () => Promise.reject(error) }),
    ).rejects.toBe(error);
    stop();

    expect(listener).not.toHaveBeenCalled();
  });
});
