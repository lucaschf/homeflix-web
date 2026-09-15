import { describe, expect, it } from "vitest";
import { PARENTAL_CONTROLS_ENABLED } from "./featureFlags";

describe("feature flags", () => {
  // The component suites mock this module, so only this test pins the
  // value that ships.
  it("ships parental controls on", () => {
    expect(PARENTAL_CONTROLS_ENABLED).toBe(true);
  });
});
