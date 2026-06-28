import { useState } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

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
const LOGO_WIDTH = { xs: 260, sm: 400, md: 560 } as const;
const LOGO_MAX_WIDTH = "100%";
const LOGO_ASPECT_RATIO = "432 / 130";
const FALLBACK_FONT_SIZE = { xs: "1.25rem", sm: "1.75rem", md: "2.5rem" } as const;

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
 * Used by the hero carousel and the detail-page header — both render
 * a large title at the top of a backdrop and benefit from the logo's
 * branding when available. Sizing is uniform across every surface
 * (see ``LOGO_WIDTH`` / ``LOGO_ASPECT_RATIO`` / ``FALLBACK_FONT_SIZE``).
 */
export function TitleLogo({ logoUrl, title, onClick, sx }: TitleLogoProps) {
  // ``imageFailed`` flips when ``onError`` fires so a 404 / network
  // failure on the logo asset transparently falls back to text on the
  // same render path. Reset is implicit — ``logoUrl`` changing
  // remounts the ``<img>`` via the ``key`` prop below.
  const [imageFailed, setImageFailed] = useState(false);

  const showLogo = Boolean(logoUrl) && !imageFailed;

  if (showLogo) {
    return (
      // Tooltip surfaces the plain title on hover — useful when a
      // stylized logo is hard to read, and gives the clickable hero
      // logo an extra affordance. ``enterDelay`` avoids flashing it on
      // a quick pass-over.
      <Tooltip title={title} enterDelay={400} placement="top-start">
        <Box
          component="img"
          // Force remount when the URL changes so a previously-failed
          // attempt for an old slide doesn't poison the new one.
          key={logoUrl}
          src={logoUrl ?? undefined}
          alt={title}
          onError={() => setImageFailed(true)}
          onClick={onClick}
          sx={{
            display: "block",
            width: LOGO_WIDTH,
            maxWidth: LOGO_MAX_WIDTH,
            aspectRatio: LOGO_ASPECT_RATIO,
            objectFit: "contain",
            objectPosition: "left",
            mb: 3,
            cursor: onClick ? "pointer" : "default",
            ...sx,
          }}
        />
      </Tooltip>
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
