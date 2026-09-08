/**
 * Responsive artwork URLs.
 *
 * Catalog artwork reaches the UI as a full URL in one of two shapes:
 *
 * - mirrored: ``/api/v1/artwork/<sha>.jpg`` — the backend serves a
 *   downscaled variant when asked with ``?w=<width>`` (ADR-034), and the
 *   untouched original without it;
 * - remote provider: ``https://image.tmdb.org/t/p/original/<file>`` —
 *   the size lives in the path segment, so swapping ``original`` for
 *   ``w780`` asks the CDN for a smaller rendition.
 *
 * Both share one width ladder, so a ``srcset`` built here is valid
 * whichever shape a title happens to be in. Anything else (scrub
 * sprites, ``data:`` URIs, bundled assets) passes through untouched.
 */

export type ArtworkKind = "backdrop" | "poster" | "logo" | "still";

/**
 * Widths the backend can derive and the provider also serves. Keep in
 * sync with ``ARTWORK_WIDTH_LADDER`` on the backend — an off-ladder
 * width is a 400 there.
 */
export const ARTWORK_LADDER: Record<ArtworkKind, readonly number[]> = {
  backdrop: [780, 1280],
  poster: [342, 500],
  logo: [300, 500],
  still: [300],
};

/**
 * Width declared for the untouched original in a ``srcset``. The real
 * file may be narrower (a 1920px backdrop, a 900px logo); declaring the
 * provider's ceiling only means the browser reaches for the original
 * when nothing smaller would be sharp enough — which is still the best
 * candidate it has.
 */
const ORIGINAL_NOMINAL_WIDTH: Record<ArtworkKind, number> = {
  backdrop: 3840,
  poster: 2000,
  logo: 2000,
  still: 1920,
};

const LOCAL_ARTWORK_PREFIX = "/api/v1/artwork/";
/** ``<sha>.w780.jpg`` — a variant key must never be asked for another width. */
const LOCAL_VARIANT_KEY = /\.w\d+\.[A-Za-z0-9]+$/;
const TMDB_SIZE_SEGMENT = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)(?:w\d+|original)(\/)/;

/** MUI default breakpoints (the theme does not override ``breakpoints.values``). */
const BREAKPOINT_MIN_WIDTH = { sm: 600, md: 900, lg: 1200, xl: 1536 } as const;
type Breakpoint = "xs" | keyof typeof BREAKPOINT_MIN_WIDTH;

export type ResponsiveWidths = Partial<Record<Breakpoint, number>>;

export interface ArtworkSources {
  /** Largest ladder variant — what a browser without ``srcset`` support loads. */
  src: string;
  /** Candidate list, or ``undefined`` when the URL is not resizable. */
  srcSet?: string;
}

function isLocalArtwork(url: string): boolean {
  return url.startsWith(LOCAL_ARTWORK_PREFIX);
}

/**
 * The same artwork at ``width`` CSS pixels, or ``url`` untouched when
 * it is not a resizable artwork URL. Existing query parameters on a
 * mirrored URL (cache-busting ``?v=``) are preserved.
 */
export function artworkUrl(url: string, width: number): string {
  if (isLocalArtwork(url)) {
    const queryStart = url.indexOf("?");
    const path = queryStart === -1 ? url : url.slice(0, queryStart);
    if (LOCAL_VARIANT_KEY.test(path)) return url;
    const params = new URLSearchParams(queryStart === -1 ? "" : url.slice(queryStart + 1));
    params.set("w", String(width));
    return `${path}?${params.toString()}`;
  }
  return url.replace(TMDB_SIZE_SEGMENT, `$1w${width}$2`);
}

/**
 * ``src`` + ``srcset`` for an ``<img>`` showing ``url`` as ``kind``.
 * Pair with ``sizes`` (see ``sizesFor``) so the browser can pick the
 * smallest candidate that is still sharp for the slot and the DPR.
 */
export function artworkSrcSet(url: string, kind: ArtworkKind): ArtworkSources {
  const ladder = ARTWORK_LADDER[kind];
  const largest = artworkUrl(url, ladder[ladder.length - 1]);
  if (largest === url) return { src: url };
  const candidates = ladder.map((width) => `${artworkUrl(url, width)} ${width}w`);
  candidates.push(`${url} ${ORIGINAL_NOMINAL_WIDTH[kind]}w`);
  return { src: largest, srcSet: candidates.join(", ") };
}

/**
 * A ``sizes`` attribute from MUI-style responsive widths (CSS px).
 * Missing steps inherit the previous one, as MUI's responsive values
 * do. ``sizes`` cannot express height media queries, so a viewport
 * height-dependent step must be folded in by the caller (err upward).
 */
export function sizesFor(widths: ResponsiveWidths): string {
  const order: Breakpoint[] = ["xs", "sm", "md", "lg", "xl"];
  let current = widths.xs ?? widths.sm ?? widths.md ?? widths.lg ?? widths.xl ?? 0;
  const resolved: Record<Breakpoint, number> = { xs: current, sm: 0, md: 0, lg: 0, xl: 0 };
  for (const bp of order) {
    current = widths[bp] ?? current;
    resolved[bp] = current;
  }
  const queries = (["xl", "lg", "md", "sm"] as const).map(
    (bp) => `(min-width:${BREAKPOINT_MIN_WIDTH[bp]}px) ${resolved[bp]}px`,
  );
  return [...queries, `${resolved.xs}px`].join(", ");
}
