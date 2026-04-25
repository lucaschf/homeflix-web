/**
 * Render a media duration in the streaming-app convention
 * (``1 h 34 min``) regardless of whether the source is the raw
 * ``duration_seconds`` from the API or the legacy ``HH:MM:SS``
 * ``duration_formatted`` string still served by some DTOs.
 *
 * Behaviour matches the spec in the detail page:
 *
 * - ≥ 1 h with extra minutes → ``"H h M min"`` (``"1 h 34 min"``)
 * - exactly N hours          → ``"N h"``
 * - < 1 h                    → ``"M min"``
 * - 0 / null / unparsable    → empty string (``input`` if it was a
 *   non-empty string we couldn't parse — preserves visibility for
 *   debugging unexpected formats coming from the backend)
 *
 * Caller passes whichever value it has at hand; preferring
 * ``duration_seconds`` when available avoids a parse round-trip and
 * shaves a 60-second rounding drift around ``HH:MM:00`` boundaries.
 */
export function formatDuration(input: number | string | null | undefined): string {
  if (input == null || input === "") return "";

  let totalSeconds: number;
  if (typeof input === "number") {
    totalSeconds = input;
  } else {
    // Parse ``HH:MM:SS`` (the only string shape the backend sends today).
    const parts = input.split(":").map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      return input;
    }
    const [hh, mm, ss] = parts;
    totalSeconds = hh * 3600 + mm * 60 + ss;
  }

  if (totalSeconds <= 0) return "";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  return `${minutes} min`;
}
