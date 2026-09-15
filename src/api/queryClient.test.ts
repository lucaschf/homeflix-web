import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
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
