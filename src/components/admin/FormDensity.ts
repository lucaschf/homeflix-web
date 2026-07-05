import { createContext, useContext } from "react";

/**
 * Vertical rhythm for stacked form rows. ``compact`` tightens the
 * per-row padding so a long settings section fits more on screen
 * without scrolling; ``comfortable`` is the default breathing room.
 */
export type FormDensity = "comfortable" | "compact";

/**
 * Ambient form density consumed by ``AdminFormSection``. Wrap a
 * subtree in ``<FormDensityContext.Provider value="compact">`` to
 * tighten it; any subtree without a provider falls back to
 * ``comfortable``, so existing pages are unaffected.
 */
export const FormDensityContext = createContext<FormDensity>("comfortable");

export function useFormDensity(): FormDensity {
  return useContext(FormDensityContext);
}
