/**
 * Parse a backend timestamp to epoch milliseconds.
 *
 * The API emits naive UTC strings (no timezone offset, e.g.
 * ``2026-06-20T18:00:00``). ``new Date`` reads those as *local* time,
 * which skews every delta and display by the viewer's UTC offset — a
 * user behind UTC sees start times in the future (elapsed timers stick
 * at ``0``) and timestamps shifted hours ahead. Appending ``Z`` when no
 * timezone designator is present makes the value read as UTC.
 *
 * Already-zoned strings (trailing ``Z`` or ``±hh:mm``) pass through
 * unchanged, so this is safe to apply blindly to any backend timestamp.
 */
export function parseServerTime(iso: string): number {
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasTimezone ? iso : `${iso}Z`).getTime();
}

/** ``parseServerTime`` as a ``Date`` — for ``toLocaleString`` callers. */
export function parseServerDate(iso: string): Date {
  return new Date(parseServerTime(iso));
}

/**
 * Format a backend timestamp as a localized relative string, handling
 * both past ("12 hours ago" / "há 12 horas") and future ("in 33
 * minutes" / "em 33 min") instants via ``Intl.RelativeTimeFormat``.
 *
 * Unlike the notifications-bell helper, this parses through
 * ``parseServerTime`` so naive-UTC backend strings aren't skewed by the
 * viewer's offset. Returns ``null`` for missing / unparseable input so
 * callers can fall back to a placeholder.
 */
export function formatRelativeServerTime(
  iso: string | null,
  locale: string,
): string | null {
  if (!iso) return null;
  const then = parseServerTime(iso);
  if (Number.isNaN(then)) return null;

  const diffSec = Math.round((then - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absSec < 60) return rtf.format(diffSec, "second");
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (absSec < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86_400), "day");
}
