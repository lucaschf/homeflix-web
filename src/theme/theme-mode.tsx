import { createContext, useContext } from "react";
import type { ThemeScheme } from "./colors";

export interface ThemeModeValue {
  /** The active scheme ("dark" = cold + peach, "amber" = warm darkroom). */
  scheme: ThemeScheme;
  /** Switch the scheme, persist it, and re-render the app in the new palette. */
  setScheme: (scheme: ThemeScheme) => void;
}

export const ThemeModeContext = createContext<ThemeModeValue | null>(null);

/**
 * Read/switch the active color scheme. Must be used under the provider wired up
 * in ``App`` — holding the state at the app root is what lets a scheme change
 * re-render the whole tree so the direct-import color tokens (which follow the
 * active scheme at render time) pick up the new palette.
 */
export const useThemeMode = (): ThemeModeValue => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used within a ThemeModeContext provider");
  }
  return ctx;
};
