import { sizesFor } from "../utils/artwork";

/**
 * Canonical sizing for the title logo, shared by every surface that
 * renders it (hero carousel + detail headers) so the branding looks
 * uniform across the app. Tweak these constants to rescale everywhere
 * at once.
 */
// HBO-style sizing: the logo lives in a fixed-aspect-ratio box whose
// WIDTH is a consistent responsive value (capped by the column). The
// image is ``object-fit: contain`` inside it, so every logo occupies
// the same horizontal footprint — wide logos fill the width, compact
// ones are centered within the derived height — and low-res PNGs are
// scaled up to fill rather than rendering at their tiny native size.
// ``md`` (900–1535px, which includes 1366×768 laptops) gets a smaller
// step than ``xl`` so the hero column — eyebrow, logo, meta, synopsis,
// actions — fits a 768px-tall window without crowding the navbar.
export const LOGO_WIDTH = { xs: 260, sm: 400, md: 480, xl: 560 } as const;
export const LOGO_MAX_WIDTH = "100%";
/** The logo box's shape, width over height. */
export const LOGO_ASPECT = 432 / 130;
export const LOGO_ASPECT_RATIO = "432 / 130";
/** ``sizes`` for the logo ``<img>``, from the same width steps as its box. */
export const LOGO_SIZES = sizesFor(LOGO_WIDTH);
