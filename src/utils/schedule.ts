/**
 * Helpers for the library scan schedule UI.
 *
 * The backend stores ``scan_schedule`` as a 5-field cron string (or
 * ``null`` for "disabled"). Users shouldn't need to know cron to pick
 * a sensible schedule, so the UI offers a handful of presets plus a
 * "Custom" escape hatch for advanced users.
 */

/**
 * Minimal translation function shape these helpers depend on.
 * Avoids coupling the module to i18next's ``TFunction`` so callers
 * can pass the ``t`` from ``useTranslation`` without casts.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Value stored in the Select when Custom is chosen. Never a valid cron. */
export const CUSTOM_SENTINEL = "__custom__";

export type PresetKey =
  | "never"
  | "every5"
  | "every15"
  | "every30"
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
  { key: "every5", cron: "*/5 * * * *", labelKey: "settings.scheduleEvery5" },
  { key: "every15", cron: "*/15 * * * *", labelKey: "settings.scheduleEvery15" },
  { key: "every30", cron: "*/30 * * * *", labelKey: "settings.scheduleEvery30" },
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
 * Tries three paths in order:
 *   1. Preset label (``"0 3 * * *"`` → "Daily at 3:00 AM").
 *   2. Humanizer for common custom shapes — ``"3 * * * *"`` →
 *      "Every hour at :03", ``"30 2 * * *"`` → "Daily at 02:30",
 *      etc. See ``humanizeCron`` for the full list of recognized
 *      patterns.
 *   3. Raw cron string, as a last-resort escape hatch for anything
 *      exotic (lists, ranges, steps).
 *
 * ``locale`` is optional for backward compatibility with older call
 * sites; omitting it disables the humanizer and falls through to the
 * raw cron, which is still readable even if not pretty.
 */
export function describeCron(
  cron: string | null,
  t: Translate,
  locale?: string,
): string {
  const key = matchPreset(cron);
  if (key !== CUSTOM_SENTINEL) {
    const preset = SCHEDULE_PRESETS.find((p) => p.key === key);
    return preset ? t(preset.labelKey) : "";
  }
  if (!cron) return "";
  const human = locale ? humanizeCron(cron, t, locale) : null;
  return human ?? cron;
}

/**
 * Format common 5-field cron shapes as natural language, or return
 * ``null`` for anything we don't recognize.
 *
 * Only covers the "single numeric value" shapes users actually pick —
 * a cron with lists (``1,15``), ranges (``1-5``) or steps (``star/5``)
 * falls through so the caller can show the raw string instead of a
 * confidently wrong translation.
 */
function humanizeCron(cron: string, t: Translate, locale: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;

  // Month must be "*" for all patterns we humanize — a specific month
  // is rare enough that the raw cron is clearer.
  if (mon !== "*") return null;

  const isNum = (v: string) => /^\d+$/.test(v);

  // "N * * * *" → hourly at minute N.
  if (isNum(min) && hour === "*" && dom === "*" && dow === "*") {
    return t("settings.scheduleEveryHourAt", {
      minute: min.padStart(2, "0"),
    });
  }

  // Remaining patterns all need a concrete time.
  if (!isNum(min) || !isNum(hour)) return null;
  const time = formatTimeOfDay(Number(hour), Number(min), locale);

  // "M H * * *" → daily at HH:MM.
  if (dom === "*" && dow === "*") {
    return t("settings.scheduleDailyAtTime", { time });
  }

  // "M H * * D" → weekly on weekday D.
  if (dom === "*" && isNum(dow)) {
    const day = weekdayName(Number(dow), locale);
    if (!day) return null;
    return t("settings.scheduleWeeklyAtTime", { day, time });
  }

  // "M H D * *" → monthly on day-of-month D.
  if (isNum(dom) && dow === "*") {
    return t("settings.scheduleMonthlyAtTime", { day: dom, time });
  }

  return null;
}

/** Locale-aware clock time (3:00 AM in en-US, 03:00 in pt-BR). */
function formatTimeOfDay(hour: number, minute: number, locale: string): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/**
 * Localized weekday name for a cron day-of-week field.
 *
 * Cron accepts 0 and 7 as Sunday; anything outside ``[0, 7]`` means
 * the field isn't a plain numeric value we can humanize.
 */
function weekdayName(dow: number, locale: string): string | null {
  if (!Number.isInteger(dow) || dow < 0 || dow > 7) return null;
  // 1970-01-04 (UTC) was a Sunday, so adding ``dow`` lands on the
  // right weekday without fighting ``Date``'s 0-indexed months.
  const d = new Date(Date.UTC(1970, 0, 4 + (dow % 7)));
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(d);
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
  t: Translate,
): string {
  if (!iso) return t("settings.neverScanned");

  const then = new Date(iso).getTime();
  // Guard: malformed ISO strings produce NaN, which would silently
  // propagate through the comparisons below and end up as "NaN days".
  if (Number.isNaN(then)) return t("settings.neverScanned");

  const now = Date.now();
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
