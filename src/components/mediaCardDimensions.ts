import type { Theme } from "@mui/material/styles";
import { shortDesktopViewport } from "../theme/tokens";

/**
 * Card width breakpoints shared by ``MediaCard`` and
 * ``CarouselSkeleton`` so the loading placeholder and the real card
 * can never drift apart (they did: the skeleton was built for wide
 * landscape cards while ``MediaCard`` still rendered them at poster
 * width, so Continue Watching cards jumped in size on load).
 *
 * - ``poster`` (2/3) is the catalog default — genre rows, related,
 *   recently added.
 * - ``landscape`` (16/9) is wider than a poster so backdrop-shaped
 *   rows (Continue Watching) read as proper landscape stills instead
 *   of poster-width slivers.
 */
export const CARD_WIDTH = {
  poster: { xs: 140, sm: 200, md: 240, lg: 280 },
  landscape: { xs: 240, sm: 320, md: 360, lg: 400 },
} as const;

export type CardShape = keyof typeof CARD_WIDTH;

/**
 * Card widths for short desktop viewports (``shortDesktopViewport`` —
 * desktop width but under 960px tall, i.e. 1366×768 laptops). The
 * width breakpoints above only know about horizontal space, so a
 * 768px-tall screen got the same 280px poster as a 1080p monitor and
 * a single card (image + title block) ate ~60% of the viewport. These
 * override every width step on such screens; tall desktops keep the
 * original ``CARD_WIDTH`` untouched.
 */
export const CARD_WIDTH_COMPACT = {
  poster: 220,
  landscape: 330,
} as const;

/**
 * Responsive ``width`` for a carousel card: the ``CARD_WIDTH`` steps,
 * overridden by ``CARD_WIDTH_COMPACT`` on short desktop viewports.
 * Spread into an sx callback so the card and its skeleton twin use
 * exactly the same rule.
 */
export function cardWidthSx(shape: CardShape, theme: Theme) {
  return {
    width: CARD_WIDTH[shape],
    [shortDesktopViewport(theme)]: { width: CARD_WIDTH_COMPACT[shape] },
  };
}
