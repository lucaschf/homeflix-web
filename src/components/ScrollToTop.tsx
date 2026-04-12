import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reset the window scroll position whenever the current route changes.
 *
 * React Router's default `<Routes>` API does not manage scroll
 * position the way a traditional page load would — the browser
 * never unloads, so scrolling from the middle of the Home feed
 * into the Movies tab leaves the user at the old offset with no
 * content there. This component watches `useLocation` and snaps
 * the window back to the top on every navigation, matching the
 * "new page" mental model users expect from a tab switch.
 *
 * The effect keys on `pathname + search` (not just `pathname`)
 * because tab switches inside `/browse` are pure query-string
 * changes — `/browse?type=movie` → `/browse?type=series` is the
 * same route as far as React Router is concerned, so a
 * pathname-only key would miss it.
 *
 * Mounted inside `Layout`, so the Player routes (which live
 * outside the layout) are untouched — full-screen playback
 * should never jump back to the top of the page on any update.
 *
 * Returns `null` — the component is effect-only, it renders
 * nothing visible.
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // `behavior: "auto"` is the instant (non-animated) default and
    // matches what a real page-load would do — a smooth scroll on
    // a tab switch would animate the *old* content out of view
    // while the new content is still resolving, which looks worse
    // than a hard cut.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
}
