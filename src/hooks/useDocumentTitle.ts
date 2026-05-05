import { useEffect } from "react";

const APP_NAME = "HomeFlix";
const SEPARATOR = " · ";

/**
 * Reflects the current page on the browser tab title.
 *
 * Sets ``document.title`` to ``"<title> · HomeFlix"`` while the
 * caller is mounted. Pass ``undefined`` / ``null`` / empty string
 * to fall back to the bare app name (the home page convention).
 *
 * Pages that depend on async data — e.g. movie / series / actor
 * detail — pass the value as ``undefined`` while the query is
 * loading and the real title once data lands. The hook re-runs
 * on every change, so the tab updates without flicker.
 *
 * No cleanup-on-unmount reset to ``HomeFlix``: the *next* page's
 * hook will set its own title on mount, and a transient reset to
 * ``HomeFlix`` between routes would just produce a flash. The
 * single source of truth is "the most recently mounted caller".
 *
 * Example:
 *
 *     useDocumentTitle(t("nav.home"));
 *     useDocumentTitle(movie ? `${movie.title} (${movie.year})` : undefined);
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const trimmed = title?.trim();
    document.title = trimmed ? `${trimmed}${SEPARATOR}${APP_NAME}` : APP_NAME;
  }, [title]);
}
