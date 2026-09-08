import { useState } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { artworkSrcSet, sizesFor } from "../utils/artwork";

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
const LOGO_WIDTH = { xs: 260, sm: 400, md: 480, xl: 560 } as const;
const LOGO_MAX_WIDTH = "100%";
const LOGO_ASPECT_RATIO = "432 / 130";
const FALLBACK_FONT_SIZE = { xs: "1.25rem", sm: "1.75rem", md: "2.5rem" } as const;
/** ``sizes`` for the logo ``<img>``, from the same width steps as its box. */
const LOGO_SIZES = sizesFor(LOGO_WIDTH);

interface TitleLogoProps {
  /** TMDB-hosted transparent PNG URL, or ``null`` when not available. */
  logoUrl: string | null | undefined;
  /** Plain-text title used as the fallback and as ``alt`` on the image. */
  title: string;
  /** Optional ``onClick`` — used by hero/detail headers that double as a navigate-to-detail control. */
  onClick?: () => void;
  /** Extra styling forwarded to the wrapper for layout tweaks (margins, alignment). */
  sx?: SxProps<Theme>;
}

/**
 * Render a movie/series title as the official transparent-PNG logo
 * (when TMDB has one) and gracefully fall back to plain text in two
 * cases: the backend has no ``logo_path`` for this title, or the
 * image fails to load (network blip, deleted asset).
 *
 * While the logo is still downloading the title is shown as text
 * *inside* the logo's reserved box, so the header never reads as
 * nameless on a slow link and nothing shifts when the image arrives.
 *
 * Used by the hero carousel and the detail-page header — both render
 * a large title at the top of a backdrop and benefit from the logo's
 * branding when available. Sizing is uniform across every surface
 * (see ``LOGO_WIDTH`` / ``LOGO_ASPECT_RATIO`` / ``FALLBACK_FONT_SIZE``).
 */
export function TitleLogo({ logoUrl, title, onClick, sx }: TitleLogoProps) {
  // Load / failure bookkeeping is keyed by URL rather than a bare
  // boolean: the hero renders one ``TitleLogo`` for every slide, so a
  // flag would leak a failed (or loaded) state from one title into
  // the next. ``loadedUrls`` remembers every logo that has decoded so
  // cycling back to a slide doesn't flash its text fallback again.
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set());
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const markLoaded = (url: string) =>
    setLoadedUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  const showLogo = Boolean(logoUrl) && failedUrl !== logoUrl;

  if (showLogo && logoUrl) {
    const loaded = loadedUrls.has(logoUrl);
    return (
      <Box
        onClick={onClick}
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          width: LOGO_WIDTH,
          maxWidth: LOGO_MAX_WIDTH,
          aspectRatio: LOGO_ASPECT_RATIO,
          // Logos squarer than the box fill its full height, so the
          // ink sits flush with the bottom edge — a 32px gap keeps the
          // meta line from crowding it (wide logos get the same gap
          // plus their own letterboxing).
          mb: 4,
          cursor: onClick ? "pointer" : "default",
          ...sx,
        }}
      >
        <Box
          component="img"
          // Force remount when the URL changes so a previously-failed
          // attempt for an old slide doesn't poison the new one.
          key={logoUrl}
          {...artworkSrcSet(logoUrl, "logo")}
          sizes={LOGO_SIZES}
          alt={title}
          decoding="async"
          onLoad={() => markLoaded(logoUrl)}
          onError={() => setFailedUrl(logoUrl)}
          // A cached image can be complete before React attaches
          // ``onLoad``; catch that on mount so it never stays hidden.
          ref={(el: HTMLImageElement | null) => {
            if (el?.complete && el.naturalWidth > 0) markLoaded(logoUrl);
          }}
          sx={{
            display: "block",
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "left",
            opacity: loaded ? 1 : 0,
            transition: "opacity 300ms ease-out",
          }}
        />
        {!loaded && (
          <Typography
            variant="h1"
            data-testid="title-logo-pending"
            sx={{ fontSize: FALLBACK_FONT_SIZE, fontWeight: 700 }}
          >
            {title}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Typography
      variant="h1"
      onClick={onClick}
      sx={{
        fontSize: FALLBACK_FONT_SIZE,
        fontWeight: 700,
        mb: 1,
        cursor: onClick ? "pointer" : "default",
        "&:hover": onClick ? { textDecoration: "underline", textUnderlineOffset: 4 } : {},
        ...sx,
      }}
    >
      {title}
    </Typography>
  );
}
