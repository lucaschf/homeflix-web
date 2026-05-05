import { Box } from "@mui/material";

interface AvatarProps {
  /** 1-3 character initials rendered at 36% of size. */
  initials: string;
  /** CSS background — typically a radial-gradient picked deterministically from the profile id. */
  tone: string;
  /** Diameter in pixels. */
  size?: number;
  /** Renders a peach 2px ring + soft halo on hover/active states. */
  ring?: boolean;
  /** Dims sibling avatars when one is hovered (Variação A behaviour kept here for reuse). */
  dim?: boolean;
}

/**
 * Circular profile tile with display-typography initials. Until
 * users upload actual avatars, the radial-gradient ``tone`` plus
 * the initials give each profile a recognisable colour identity
 * across the picker, the manage screen and the AccountMenu chip.
 *
 * Initials use Space Grotesk — the same display family the
 * theme assigns to ``h1``/``h2``/``h3`` — so the avatar reads as
 * part of the same typographic system rather than dropping into a
 * generic serif (which fell back to Times-Roman-ish on most
 * systems and clashed with the rest of the UI).
 */
export function Avatar({ initials, tone, size = 96, ring = false, dim = false }: AvatarProps) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: tone,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
        fontWeight: 600,
        fontSize: size * 0.36,
        color: "rgba(255, 255, 255, 0.92)",
        letterSpacing: "-0.02em",
        textTransform: "uppercase",
        border: ring ? "2px solid" : "1px solid rgba(255, 255, 255, 0.08)",
        borderColor: ring ? "primary.main" : undefined,
        boxShadow: ring ? "0 0 0 4px rgba(217, 119, 87, 0.15)" : "none",
        filter: dim ? "brightness(0.55) saturate(0.7)" : "none",
        transition: "all 200ms ease",
        flexShrink: 0,
      }}
    >
      {initials}
    </Box>
  );
}

