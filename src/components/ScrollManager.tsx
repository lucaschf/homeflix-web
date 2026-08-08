import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Module-level cache of scroll offsets keyed by history entry. Survives
// re-renders and route changes for the lifetime of the tab.
const scrollPositions = new Map<string, number>();

/**
 * Scroll management for the SPA.
 *
 * - New navigation (PUSH / REPLACE — a tab switch, opening a title):
 *   snap to the top, matching the "new page" mental model.
 * - Back / forward (POP): restore the offset the user last had at that
 *   history entry, so returning from a detail page lands them back
 *   where they were in a long feed instead of at the top.
 *
 * Replaces the previous scroll-to-top-on-every-change behaviour, which
 * also reset the position on back navigation and lost the user's place.
 *
 * Mounted inside `Layout`, so the full-screen Player routes (which live
 * outside the layout) are untouched.
 */
export function ScrollManager() {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") {
      window.scrollTo({ top: scrollPositions.get(key) ?? 0, left: 0, behavior: "auto" });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    // Keep this entry's offset up to date while it's on screen so a
    // later back-navigation can restore it.
    const handleScroll = () => {
      scrollPositions.set(key, window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [key, navigationType]);

  return null;
}
