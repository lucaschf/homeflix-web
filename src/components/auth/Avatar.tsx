import { useState } from "react";
import { Box } from "@mui/material";
import { whiteAlpha, peachAlpha } from "../../theme/tokens";

interface AvatarProps {
  /** 1-3 character initials rendered at 36% of size. */
  initials: string;
  /** CSS background — typically a radial-gradient picked deterministically from the profile id. */
  tone: string;
  /**
   * Optional URL of the persisted avatar image. When set the
   * ``<img>`` is rendered on top of the gradient/initials base; the
   * fallback automatically takes over if the image fails to load
   * (404, network blip, format error). ``null`` / ``undefined`` →
   * just the gradient + initials, no image element.
   */
  avatarUrl?: string | null;
  /** Diameter in pixels (or side length when ``shape="rounded"``). */
  size?: number;
  /**
   * ``"circle"`` — full-round (used by the AccountMenu chip and
   *   anywhere the small inline identity hint reads as a "head".
   * ``"rounded"`` — Netflix-style rounded square; the tile shape
   *   used by the picker and the manage screen so a row of
   *   profiles reads as content tiles rather than head shots.
   */
  shape?: "circle" | "rounded";
  /** Renders a peach 2px ring + soft halo on hover/active states. */
  ring?: boolean;
  /** Dims sibling avatars when one is hovered (Variação A behaviour kept here for reuse). */
  dim?: boolean;
}

/**
 * Profile tile that prefers an uploaded image and gracefully falls
 * back to a deterministic radial-gradient with serif initials.
 * Used in three places (picker, manage screen, AccountMenu chip)
 * with the same visual contract.
 *
 * The fallback is what the user sees until they upload a photo.
 * The image takes over when ``avatarUrl`` is set; ``onError`` flips
 * back to the fallback if the URL fails for any reason — better
 * silently degrade to initials than show a broken-image icon.
 *
 * Initials use Space Grotesk — the same display family the theme
 * assigns to ``h1``/``h2``/``h3`` — so the avatar reads as part of
 * the same typographic system.
 */
export function Avatar({
  initials,
  tone,
  avatarUrl,
  size = 96,
  shape = "circle",
  ring = false,
  dim = false,
}: AvatarProps) {
  const isRounded = shape === "rounded";
  // ``failedUrl`` records the URL whose ``<img>`` last fired
  // ``onError`` so the fallback takes over for that exact URL.
  // Storing the URL itself (rather than a boolean) auto-resets when
  // the prop changes — a fresh post-upload ``?v=`` query string is
  // a different value, so the comparison drops the failure marker
  // without needing a useEffect setState (which the
  // ``react-hooks/set-state-in-effect`` rule rejects for cascading
  // renders).
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(avatarUrl) && avatarUrl !== failedUrl;

  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: isRounded ? `${Math.round(size * 0.16)}px` : "50%",
        background: tone,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
        fontWeight: 600,
        fontSize: size * 0.36,
        color: whiteAlpha(0.92),
        letterSpacing: "-0.02em",
        textTransform: "uppercase",
        border: ring ? "2px solid" : `1px solid ${whiteAlpha(0.08)}`,
        borderColor: ring ? "primary.main" : undefined,
        boxShadow: ring ? `0 0 0 4px ${peachAlpha(0.15)}` : "none",
        filter: dim ? "brightness(0.55) saturate(0.7)" : "none",
        transition: "all 200ms ease",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Fallback layer is always present so the initials are
          readable behind a slow-loading image. ``aria-hidden``
          because the ``<img>`` carries the alt text. */}
      <span aria-hidden>{initials}</span>
      {showImage && (
        <Box
          component="img"
          // ``key`` forces a remount when the URL changes so the
          // browser refetches a freshly cache-busted ``?v=`` instead
          // of reusing a stale cached element.
          key={avatarUrl}
          src={avatarUrl ?? undefined}
          alt=""
          onError={() => setFailedUrl(avatarUrl ?? null)}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
    </Box>
  );
}
