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
