import { describe, expect, it } from "vitest";
import { PARENTAL_CONTROLS_ENABLED } from "./featureFlags";

describe("feature flags", () => {
  // The component suites mock this module, so only this test pins the
  // value that ships. Flip it together with the flag when the parental
  // controls backend is deployed and the PIN challenge has landed.
  it("keeps parental controls off until the backend and PIN UI are live", () => {
    expect(PARENTAL_CONTROLS_ENABLED).toBe(false);
  });
});
