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
