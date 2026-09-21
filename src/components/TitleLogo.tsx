import { Fragment, useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { fontFamily, scrim } from "../theme/tokens";
import { artworkSrcSet } from "../utils/artwork";
import { LOCKUP_LINE_HEIGHT, titleLockup } from "./titleLockup";
import { LOGO_ASPECT_RATIO, LOGO_MAX_WIDTH, LOGO_SIZES, LOGO_WIDTH } from "./titleLogoSizing";

// The logo's footprint, except on phones: there the card spans the
// column, since at the 260px logo step a long title would set at ~18px.
const TITLE_CARD_WIDTH = { ...LOGO_WIDTH, xs: "100%" } as const;

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
 * (when TMDB has one) and gracefully fall back to a typeset one — a
 * ``TitleCard`` lockup — in two cases: the backend has no ``logo_path``
 * for this title, or the image fails to load (network blip, deleted
 * asset).
 *
 * While the logo is still downloading the title is shown as text
 * *inside* the logo's reserved box, so the header never reads as
 * nameless on a slow link and nothing shifts when the image arrives.
 *
 * Used by the hero carousel and the detail-page header — both render
 * a large title at the top of a backdrop and benefit from the logo's
 * branding when available. Sizing is uniform across every surface
 * (see ``LOGO_WIDTH`` / ``LOGO_ASPECT_RATIO``).
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
          <TitleCard title={title} data-testid="title-logo-pending" sx={{ width: "100%" }} />
        )}
      </Box>
    );
  }

  return (
    <TitleCard
      title={title}
      onClick={onClick}
      sx={{ width: TITLE_CARD_WIDTH, mb: 1.5, cursor: onClick ? "pointer" : "default", ...sx }}
    />
  );
}

interface TitleCardProps {
  title: string;
  onClick?: () => void;
  "data-testid"?: string;
  sx?: SxProps<Theme>;
}

/**
 * The title set as a logo would be (see ``titleLockup``): all caps in
 * the display face, each line sized in ``cqi`` — a fraction of the
 * card's own width — so the lockup fills the logo's footprint at every
 * breakpoint and in any narrower column. The lines are separate blocks
 * with a space between them, so the heading still reads as one title.
 */
function TitleCard({ title, onClick, "data-testid": testId, sx }: TitleCardProps) {
  const { lines, sizes } = useMemo(() => titleLockup(title), [title]);
  return (
    <Typography
      variant="h1"
      onClick={onClick}
      data-testid={testId}
      sx={{
        containerType: "inline-size",
        width: LOGO_WIDTH,
        maxWidth: LOGO_MAX_WIDTH,
        fontFamily: fontFamily.display,
        fontWeight: 800,
        letterSpacing: 0,
        textTransform: "uppercase",
        color: "common.white",
        // Lifts the letters off a bright backdrop, as a logo's own art does.
        textShadow: `0 2px 24px ${scrim(0.45)}`,
        ...sx,
      }}
    >
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <Box
            component="span"
            sx={{
              display: "block",
              whiteSpace: "nowrap",
              fontSize: `${(sizes[i] * 100).toFixed(2)}cqi`,
              lineHeight: LOCKUP_LINE_HEIGHT,
            }}
          >
            {line}
          </Box>
        </Fragment>
      ))}
    </Typography>
  );
}
