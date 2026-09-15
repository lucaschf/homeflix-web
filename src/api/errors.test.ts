import { describe, expect, it } from "vitest";
import { ApiError, type ApiErrorBody } from "./client";
import { apiErrorCode, apiErrorMeta } from "./errors";

/** The envelope the backend sends with a locked parental PIN. */
const locked = new ApiError(403, "Forbidden", {
  message: "Too many wrong PIN attempts",
  code: "PARENTAL_PIN_LOCKED",
  type: "forbidden",
  details: [
    {
      code: "PARENTAL_PIN_LOCKED",
      message: "Locked",
      metadata: { retry_after_seconds: 120 },
    },
  ],
});

describe("apiErrorCode", () => {
  it("reads the stable code, not the human message", () => {
    expect(apiErrorCode(locked)).toBe("PARENTAL_PIN_LOCKED");
  });

  it("is undefined for a body without a code", () => {
    expect(apiErrorCode(new ApiError(502, "Bad Gateway", null))).toBeUndefined();
  });

  it("is undefined for anything that is not an ApiError", () => {
    expect(apiErrorCode(new Error("PARENTAL_PIN_LOCKED"))).toBeUndefined();
    expect(apiErrorCode({ body: { code: "PARENTAL_PIN_LOCKED" } })).toBeUndefined();
    expect(apiErrorCode(undefined)).toBeUndefined();
  });
});

describe("apiErrorMeta", () => {
  it("reads a value out of details[].metadata", () => {
    expect(apiErrorMeta(locked, "retry_after_seconds")).toBe(120);
  });

  it("ignores the same key at the top of the body", () => {
    const topLevel = new ApiError(403, "Forbidden", {
      code: "PARENTAL_PIN_LOCKED",
      retry_after_seconds: 120,
      details: [],
    } as ApiErrorBody);
    expect(apiErrorMeta(topLevel, "retry_after_seconds")).toBeUndefined();
  });

  it("takes the first detail that carries the key", () => {
    const err = new ApiError(403, "Forbidden", {
      code: "CONTENT_RESTRICTED_BY_MATURITY",
      details: [
        { code: "X", message: "no metadata" },
        { code: "Y", message: "other key", metadata: { profile_limit: 12 } },
        { code: "Z", message: "wanted", metadata: { required_age: 16 } },
      ],
    });
    expect(apiErrorMeta(err, "required_age")).toBe(16);
    expect(apiErrorMeta(err, "profile_limit")).toBe(12);
  });

  it("is undefined when details is missing or not a list", () => {
    expect(apiErrorMeta(new ApiError(403, "Forbidden", { code: "A" }), "k")).toBeUndefined();
    expect(
      apiErrorMeta(new ApiError(403, "Forbidden", { code: "A", details: "oops" }), "k"),
    ).toBeUndefined();
  });

  it("is undefined for anything that is not an ApiError", () => {
    expect(apiErrorMeta(new Error("boom"), "retry_after_seconds")).toBeUndefined();
    expect(apiErrorMeta(null, "retry_after_seconds")).toBeUndefined();
  });
});
