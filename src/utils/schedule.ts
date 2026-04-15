/**
 * Helpers for the library scan schedule UI.
 *
 * The backend stores ``scan_schedule`` as a 5-field cron string (or
 * ``null`` for "disabled"). Users shouldn't need to know cron to pick
 * a sensible schedule, so the UI offers a handful of presets plus a
 * "Custom" escape hatch for advanced users.
 */

import type { TFunction } from "i18next";

/** Value stored in the Select when Custom is chosen. Never a valid cron. */
export const CUSTOM_SENTINEL = "__custom__";

export type PresetKey =
  | "never"
  | "hourly"
  | "daily"
  | "weekly"
  | typeof CUSTOM_SENTINEL;

export interface SchedulePreset {
  /** Internal key used by the Select. */
  key: PresetKey;
  /** Cron string for this preset, or ``null`` for Never. Custom has no fixed value. */
  cron: string | null | undefined;
  /** i18n key for the label. */
  labelKey: string;
}

/** Ordered list of presets shown in the Select. */
export const SCHEDULE_PRESETS: readonly SchedulePreset[] = [
  { key: "never", cron: null, labelKey: "settings.scheduleNever" },
  { key: "hourly", cron: "0 * * * *", labelKey: "settings.scheduleHourly" },
  { key: "daily", cron: "0 3 * * *", labelKey: "settings.scheduleDaily" },
  { key: "weekly", cron: "0 3 * * 0", labelKey: "settings.scheduleWeekly" },
  { key: CUSTOM_SENTINEL, cron: undefined, labelKey: "settings.scheduleCustom" },
] as const;

/**
 * Map a cron string (or null) back to a preset key.
 *
 * Returns ``"never"`` for ``null``, the matching preset's key for a
 * known cron, or ``CUSTOM_SENTINEL`` otherwise.
 */
export function matchPreset(cron: string | null): PresetKey {
  if (cron === null) return "never";
  const hit = SCHEDULE_PRESETS.find((p) => p.cron === cron);
  return hit ? hit.key : CUSTOM_SENTINEL;
}

/**
 * Human-friendly summary of a cron for display on library cards.
 *
 * Returns the translated preset label when ``cron`` matches one;
 * otherwise the raw cron string (custom).
 */
export function describeCron(cron: string | null, t: TFunction): string {
  const key = matchPreset(cron);
  if (key === CUSTOM_SENTINEL) return cron ?? "";
  const preset = SCHEDULE_PRESETS.find((p) => p.key === key);
  return preset ? t(preset.labelKey) : "";
}

/** Loose sanity check for custom cron input — 5 non-empty whitespace-separated fields. */
export function isPlausibleCron(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 5 && parts.every((p) => p.length > 0);
}

/**
 * Format an ISO timestamp as a short relative string ("2h ago").
 *
 * Uses ``Intl.RelativeTimeFormat`` when the runtime supports it; falls
 * back to i18n keys (``justNow``, ``minutesAgo``, ``hoursAgo``,
 * ``daysAgo``) for older environments.
 */
export function formatRelativeTime(
  iso: string | null,
  locale: string,
  t: TFunction,
): string {
  if (!iso) return t("settings.neverScanned");

  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - now) / 1000);
  const absSec = Math.abs(diffSec);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (absSec < 60) return rtf.format(diffSec, "second");
    if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (absSec < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
    return rtf.format(Math.round(diffSec / 86_400), "day");
  } catch {
    // Fallback for environments without Intl.RelativeTimeFormat.
    if (absSec < 60) return t("settings.justNow");
    if (absSec < 3600) {
      return t("settings.minutesAgo", { count: Math.round(absSec / 60) });
    }
    if (absSec < 86_400) {
      return t("settings.hoursAgo", { count: Math.round(absSec / 3600) });
    }
    return t("settings.daysAgo", { count: Math.round(absSec / 86_400) });
  }
}
