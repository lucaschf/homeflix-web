import { createContext, useContext } from "react";
import type { SettingsScope } from "./settingsSections";

export type SettingsVariant = "rail" | "accordion";

export interface SettingsSectionCtx {
  /** Which layout is rendering this section. In ``rail`` the shell
   *  draws its own header (icon + title + dirty dot + scope badge);
   *  in ``accordion`` the header is owned by the accordion row and
   *  the shell renders body + footer only. */
  variant: SettingsVariant;
  /** ``default`` (grey) or ``admin`` (green) scope badge. */
  scope: SettingsScope;
  /** Lifts the section's dirty flag up to the layout so the rail
   *  nav / accordion header can render the unsaved-edits dot. */
  reportDirty: (dirty: boolean) => void;
}

const noop = () => {};

/**
 * Ambient wiring shared between a settings layout (rail/accordion)
 * and the ``SettingsCardShell`` it renders. Passed via context so
 * the eight bucket cards don't each have to thread ``variant`` /
 * ``reportDirty`` through their own prop lists.
 */
export const SettingsSectionContext = createContext<SettingsSectionCtx>({
  variant: "rail",
  scope: "admin",
  reportDirty: noop,
});

export function useSettingsSection(): SettingsSectionCtx {
  return useContext(SettingsSectionContext);
}
