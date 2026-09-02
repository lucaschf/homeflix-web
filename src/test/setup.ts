import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when the runner exposes global
// afterEach; this suite runs without globals, so unmount by hand.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
