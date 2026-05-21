/**
 * Relative-time formatting used by the notifications bell.
 *
 * The file kept its name from a richer earlier life — when the
 * library scan-schedule UI lived in /settings it also exposed
 * cron presets, humanizers, and validators here. That UI moved
 * to /admin (where it just renders a free-form cron input), and
 * the only remaining caller is ``formatRelativeTime`` for
 * notification timestamps.
 */

/**
 * Minimal translation function shape these helpers depend on.
 * Avoids coupling the module to i18next's ``TFunction`` so callers
 * can pass the ``t`` from ``useTranslation`` without casts.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Format an ISO timestamp as a short relative string ("2h ago").
 *
 * Uses ``Intl.RelativeTimeFormat`` when the runtime supports it; falls
 * back to i18n keys (``justNow``, ``minutesAgo``, ``hoursAgo``,
 * ``daysAgo``) for older environments. A null / unparseable timestamp
 * collapses to ``settings.neverScanned`` — the inherited key name
 * is misleading post-cleanup, but renaming it would churn every
 * locale for no observable user gain.
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
