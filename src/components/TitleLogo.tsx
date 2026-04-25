import { useState } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface TitleLogoProps {
  /** TMDB-hosted transparent PNG URL, or ``null`` when not available. */
  logoUrl: string | null | undefined;
  /** Plain-text title used as the fallback and as ``alt`` on the image. */
  title: string;
  /**
   * Max height of the rendered logo. The image keeps its native aspect
   * ratio inside this box. The fallback ``<Typography>`` ignores this
   * value and uses its own variant-driven sizing.
   */
  maxHeight: { xs: number; sm?: number; md: number };
  /** Optional ``onClick`` — used by hero/detail headers that double as a navigate-to-detail control. */
  onClick?: () => void;
  /** Extra styling forwarded to the wrapper for layout tweaks (margins, alignment). */
  sx?: SxProps<Theme>;
  /** Variant for the fallback ``<Typography>`` so it matches the surrounding heading scale. */
  fallbackVariant?: "h1" | "h2" | "h3";
  /** Font size override for the fallback, mirroring the existing ``Typography`` calls in MovieDetail / SeriesDetail. */
  fallbackFontSize?: { xs: string; sm?: string; md: string };
}

/**
 * Render a movie/series title as the official transparent-PNG logo
 * (when TMDB has one) and gracefully fall back to plain text in two
 * cases: the backend has no ``logo_path`` for this title, or the
 * image fails to load (network blip, deleted asset).
 *
 * Used by the hero carousel and the detail-page header — both render
 * a large title at the top of a backdrop and benefit from the logo's
 * branding when available.
 */
export function TitleLogo({
  logoUrl,
  title,
  maxHeight,
  onClick,
  sx,
  fallbackVariant = "h1",
  fallbackFontSize,
}: TitleLogoProps) {
  // ``imageFailed`` flips when ``onError`` fires so a 404 / network
  // failure on the logo asset transparently falls back to text on the
  // same render path. Reset is implicit — ``logoUrl`` changing
  // remounts the ``<img>`` via the ``key`` prop below.
  const [imageFailed, setImageFailed] = useState(false);

  const showLogo = Boolean(logoUrl) && !imageFailed;

  if (showLogo) {
    return (
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
          height: "auto",
          width: "auto",
          maxHeight,
          maxWidth: "100%",
          objectFit: "contain",
          objectPosition: "left",
          mb: 1,
          cursor: onClick ? "pointer" : "default",
          ...sx,
        }}
      />
    );
  }

  return (
    <Typography
      variant={fallbackVariant}
      onClick={onClick}
      sx={{
        fontSize: fallbackFontSize,
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
