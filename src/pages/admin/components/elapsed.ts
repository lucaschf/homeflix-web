import { useEffect, useState } from "react";

/**
 * Live-updating "elapsed seconds" counter for the in-flight banner
 * shared by the Scan and Enrich admin pages. Reads the latest
 * started-running row's ``started_at`` and ticks every second so
 * the operator sees the timer move.
 *
 * Returns ``0`` when ``startIso`` is falsy — caller doesn't need
 * to guard the formatter separately.
 */
export function useElapsedSeconds(startIso: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startIso]);

  if (!startIso) return 0;
  return Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
}

/**
 * Compact ``"35s"`` / ``"2m 14s"`` formatter used by the in-flight
 * banner. Minutes are not zero-padded — the banner is meant to
 * read at a glance, not as a precise timer.
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}
